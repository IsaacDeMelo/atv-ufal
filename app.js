const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const app = express();
const PORT = 3000;


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

let atividades = [];
let idCounter = 1;

// View: List all atividades
app.get('/', (req, res) => {
    const isAdmin = req.session && req.session.isAdmin;
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
app.post('/atividades', (req, res) => {
    if (!req.session || !req.session.isAdmin) {
        return res.status(403).send('Acesso negado');
    }
    const { materia, descricao, nota, dataEntrega } = req.body;
    if (!materia || !descricao) return res.status(400).send('Matéria e descrição são obrigatórios');
    const atividade = {
        id: idCounter++,
        materia,
        descricao,
        nota: nota ? parseFloat(nota) : null,
        dataEntrega: dataEntrega || null
    };
    atividades.push(atividade);
    res.redirect('/');
});

// View: Edit form (protegido)
app.get('/edit/:id', (req, res) => {
    if (!req.session || !req.session.isAdmin) {
        return res.redirect('/admin');
    }
    const atividade = atividades.find(a => a.id === parseInt(req.params.id));
    if (!atividade) return res.status(404).send('Atividade não encontrada');
    res.render('edit', { atividade });
});

// Update (form)
app.post('/edit/:id', (req, res) => {
    if (!req.session || !req.session.isAdmin) {
        return res.status(403).send('Acesso negado');
    }
    const atividade = atividades.find(a => a.id === parseInt(req.params.id));
    if (!atividade) return res.status(404).send('Atividade não encontrada');
    const { materia, descricao, nota, dataEntrega } = req.body;
    if (!materia || !descricao) return res.status(400).send('Matéria e descrição são obrigatórios');
    atividade.materia = materia;
    atividade.descricao = descricao;
    atividade.nota = nota ? parseFloat(nota) : null;
    atividade.dataEntrega = dataEntrega || null;
    res.redirect('/');
});

// Delete (form)
app.post('/delete/:id', (req, res) => {
    if (!req.session || !req.session.isAdmin) {
        return res.status(403).send('Acesso negado');
    }
    const index = atividades.findIndex(a => a.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).send('Atividade não encontrada');
    atividades.splice(index, 1);
    res.redirect('/');
});

// Página de detalhes da atividade
app.get('/atividades/:id', (req, res) => {
    const atividade = atividades.find(a => a.id === parseInt(req.params.id));
    if (!atividade) return res.status(404).send('Atividade não encontrada');
    res.render('detalhes', { atividade });
});

// REST API endpoints
app.get('/atividades', (req, res) => {
    res.json(atividades);
});

app.get('/api/atividades/:id', (req, res) => {
    const atividade = atividades.find(a => a.id === parseInt(req.params.id));
    if (!atividade) return res.status(404).json({ error: 'Atividade não encontrada' });
    res.json(atividade);
});

app.put('/atividades/:id', (req, res) => {
    const atividade = atividades.find(a => a.id === parseInt(req.params.id));
    if (!atividade) return res.status(404).json({ error: 'Atividade não encontrada' });
    const { materia, descricao, nota, dataEntrega } = req.body;
    if (!materia || !descricao) return res.status(400).json({ error: 'Matéria e descrição são obrigatórios' });
    atividade.materia = materia;
    atividade.descricao = descricao;
    atividade.nota = nota ? parseFloat(nota) : null;
    atividade.dataEntrega = dataEntrega || null;
    res.json(atividade);
});

app.delete('/atividades/:id', (req, res) => {
    const index = atividades.findIndex(a => a.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ error: 'Atividade não encontrada' });
    atividades.splice(index, 1);
    res.status(204).send();
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});