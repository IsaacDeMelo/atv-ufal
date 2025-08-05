const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const { MongoClient, ObjectId, GridFSBucket } = require('mongodb');
const multer = require('multer');
const app = express();
const PORT = 3000;

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://iahfm1:brasil2021@cluster0.xklnmes.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
let db, bucket;

const upload = multer({ storage: multer.memoryStorage() });

MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(client => {
    db = client.db();
    bucket = new GridFSBucket(db, { bucketName: 'uploads' });
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => console.error('MongoDB connection error:', err));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'views')));
app.use(session({
    secret: 'atividade-secret',
    resave: false,
    saveUninitialized: true
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// View: List all atividades
app.get('/', async (req, res) => {
    const isAdmin = req.session && req.session.isAdmin;
    const atividades = await db.collection('atividades').find().toArray();
    res.render('index', { atividades, isAdmin });
});

// Admin login form
app.get('/admin', (req, res) => {
    res.render('admin');
});

// Admin login submit
app.post('/admin', (req, res) => {
    const { senha } = req.body;
    if (senha === '12345') {
        req.session.isAdmin = true;
        return res.redirect('/');
    }
    res.render('admin', { error: 'Senha incorreta' });
});

// Logout admin
app.post('/logout', (req, res) => {
    req.session.isAdmin = false;
    res.redirect('/');
});

// View: Form to create atividade (protegido)
app.get('/new', (req, res) => {
    if (!req.session || !req.session.isAdmin) {
        return res.status(403).send('Acesso negado');
    }
    res.render('new');
});

// Create (form)
app.post('/atividades', upload.single('anexo'), async (req, res) => {
    if (!req.session || !req.session.isAdmin) {
        return res.status(403).send('Acesso negado');
    }
    const { materia, descricao, nota, dataEntrega } = req.body;
    if (!materia || !descricao) return res.status(400).send('Matéria e descrição são obrigatórios');
    let anexo = null;
    if (req.file) {
        // Salva o arquivo no GridFS
        const uploadStream = bucket.openUploadStream(Date.now() + '-' + req.file.originalname, {
            contentType: req.file.mimetype
        });
        uploadStream.end(req.file.buffer);
        uploadStream.on('finish', async () => {
            anexo = {
                fileId: uploadStream.id,
                filename: req.file.originalname,
                originalname: req.file.originalname,
                mimetype: req.file.mimetype
            };
            await db.collection('atividades').insertOne({
                materia,
                descricao,
                nota: nota ? parseFloat(nota) : null,
                dataEntrega: dataEntrega || null,
                anexo
            });
            res.redirect('/');
        });
        return;
    }
    await db.collection('atividades').insertOne({
        materia,
        descricao,
        nota: nota ? parseFloat(nota) : null,
        dataEntrega: dataEntrega || null,
        anexo
    });
    res.redirect('/');
});

// View: Edit form (protegido)
app.get('/edit/:id', async (req, res) => {
    if (!req.session || !req.session.isAdmin) {
        return res.redirect('/admin');
    }
    const atividade = await db.collection('atividades').findOne({ _id: new ObjectId(req.params.id) });
    if (!atividade) return res.status(404).send('Atividade não encontrada');
    res.render('edit', { atividade });
});

// Update (form)
app.post('/edit/:id', upload.single('anexo'), async (req, res) => {
    if (!req.session || !req.session.isAdmin) {
        return res.status(403).send('Acesso negado');
    }
    const atividade = await db.collection('atividades').findOne({ _id: new ObjectId(req.params.id) });
    if (!atividade) return res.status(404).send('Atividade não encontrada');
    const { materia, descricao, nota, dataEntrega } = req.body;
    let anexo = atividade.anexo;
    if (req.file) {
        // Remove arquivo anterior do GridFS se existir
        if (anexo && anexo.fileId) {
            try { await bucket.delete(anexo.fileId); } catch {}
        }
        // Salva novo arquivo
        const uploadStream = bucket.openUploadStream(Date.now() + '-' + req.file.originalname, {
            contentType: req.file.mimetype
        });
        uploadStream.end(req.file.buffer);
        uploadStream.on('finish', async () => {
            anexo = {
                fileId: uploadStream.id,
                filename: req.file.originalname,
                originalname: req.file.originalname,
                mimetype: req.file.mimetype
            };
            await db.collection('atividades').updateOne(
                { _id: new ObjectId(req.params.id) },
                { $set: { materia, descricao, nota: nota ? parseFloat(nota) : null, dataEntrega: dataEntrega || null, anexo } }
            );
            res.redirect('/');
        });
        return;
    }
    await db.collection('atividades').updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { materia, descricao, nota: nota ? parseFloat(nota) : null, dataEntrega: dataEntrega || null, anexo } }
    );
    res.redirect('/');
});

// Delete (form)
app.post('/delete/:id', async (req, res) => {
    if (!req.session || !req.session.isAdmin) {
        return res.status(403).send('Acesso negado');
    }
    const atividade = await db.collection('atividades').findOne({ _id: new ObjectId(req.params.id) });
    if (!atividade) return res.status(404).send('Atividade não encontrada');
    // Remove arquivo anexo do GridFS se existir
    if (atividade.anexo && atividade.anexo.fileId) {
        try { await bucket.delete(atividade.anexo.fileId); } catch {}
    }
    await db.collection('atividades').deleteOne({ _id: new ObjectId(req.params.id) });
    res.redirect('/');
});

// Página de detalhes da atividade
app.get('/atividades/:id', async (req, res) => {
    const atividade = await db.collection('atividades').findOne({ _id: new ObjectId(req.params.id) });
    if (!atividade) return res.status(404).send('Atividade não encontrada');
    res.render('detalhes', { atividade });
});

// Download do arquivo anexo com nome original
app.get('/download/:fileId', async (req, res) => {
    try {
        const _id = new ObjectId(req.params.fileId);
        const files = await db.collection('uploads.files').find({ _id }).toArray();
        if (!files || files.length === 0) return res.status(404).send('Arquivo não encontrado');
        const file = files[0];
        res.set('Content-Type', file.contentType || file.mimetype);
        res.set('Content-Disposition', `attachment; filename="${file.filename}"`);
        const downloadStream = bucket.openDownloadStream(_id);
        downloadStream.on('error', () => res.status(404).send('Arquivo não encontrado'));
        downloadStream.pipe(res);
    } catch (err) {
        res.status(404).send('Arquivo não encontrado');
    }
});

// REST API endpoints
app.get('/atividades', async (req, res) => {
    const atividades = await db.collection('atividades').find().toArray();
    res.json(atividades);
});

app.get('/api/atividades/:id', async (req, res) => {
    const atividade = await db.collection('atividades').findOne({ _id: new ObjectId(req.params.id) });
    if (!atividade) return res.status(404).json({ error: 'Atividade não encontrada' });
    res.json(atividade);
});

app.put('/atividades/:id', async (req, res) => {
    const { materia, descricao, nota, dataEntrega } = req.body;
    if (!materia || !descricao) return res.status(400).json({ error: 'Matéria e descrição são obrigatórios' });
    await db.collection('atividades').updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { materia, descricao, nota: nota ? parseFloat(nota) : null, dataEntrega: dataEntrega || null } }
    );
    res.json({ success: true });
});

app.delete('/atividades/:id', async (req, res) => {
    const atividade = await db.collection('atividades').findOne({ _id: new ObjectId(req.params.id) });
    if (!atividade) return res.status(404).json({ error: 'Atividade não encontrada' });
    if (atividade.anexo && atividade.anexo.fileId) {
        try { await gfs.remove({ _id: atividade.anexo.fileId, root: 'uploads' }); } catch {}
    }
    await db.collection('atividades').deleteOne({ _id: new ObjectId(req.params.id) });
    res.status(204).send();
});