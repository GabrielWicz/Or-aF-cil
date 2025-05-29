const express = require('express');
const Handlebars = require('handlebars');
const path = require('path');
const { engine } = require('express-handlebars');
const sequelize = require('./sequelize');
const Produto = require('./models/produto');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do Handlebars
app.engine('handlebars', engine({
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views/layouts'),
  partialsDir: path.join(__dirname, 'views/partials')
}));
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

Handlebars.registerHelper('formatarMoeda', function (valor) {
  return `R$ ${parseFloat(valor).toFixed(2).replace('.', ',')}`;
});

Handlebars.registerHelper('json', function(context) {
  return JSON.stringify(context);
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// =========================================================//

const ExcelJS = require('exceljs');

app.post('/gerar-excel', async (req, res) => {
  const { cliente, produtos } = req.body;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Orçamento');

  // Cabeçalho do cliente
  worksheet.addRow(['Orçamento']).font = { size: 16, bold: true };
  worksheet.addRow([]);
  worksheet.addRow(['Nome do Cliente:', cliente.nome]);
  worksheet.addRow(['Telefone:', cliente.telefone]);
  worksheet.addRow(['Email:', cliente.email]);
  worksheet.addRow(['Endereço:', cliente.endereco]);
  worksheet.addRow([]);

  // Cabeçalhos da tabela
  const header = ['Produto', 'Categoria', 'Quantidade', 'Valor Unitário', 'Valor Total'];
  const headerRow = worksheet.addRow(header);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center' };

  // Dados
  let totalGeral = 0;

  produtos.forEach(p => {
    const total = p.quantidade * p.valor;
    totalGeral += total;

    worksheet.addRow([
      p.nome,
      p.categoria,
      p.quantidade,
      p.valor,
      total
    ]);
  });

  // Formatar colunas de valor como moeda
  worksheet.getColumn(4).numFmt = 'R$ #,##0.00';
  worksheet.getColumn(5).numFmt = 'R$ #,##0.00';

  // Alinhar todas as células ao centro
  worksheet.columns.forEach(col => {
    col.alignment = { vertical: 'middle', horizontal: 'center' };
    col.width = 20; // ou: ajustar automaticamente
  });

  // Linha final com total geral
  worksheet.addRow([]);
  const totalRow = worksheet.addRow(['', '', '', 'Total Geral:', totalGeral]);
  totalRow.getCell(5).numFmt = 'R$ #,##0.00';
  totalRow.font = { bold: true };

  // Salvar arquivo
  const nomeArquivo = `orcamento_${Date.now()}.xlsx`;
  const caminho = path.join(__dirname, 'public', nomeArquivo);
  await workbook.xlsx.writeFile(caminho);

  res.json({ caminho: `/public/${nomeArquivo}` });
});

// =========================================================//

const PDFDocument = require('pdfkit');
const fs = require('fs');
const bodyParser = require('body-parser');

app.use(bodyParser.json()); // Para aceitar JSON vindo do frontend

app.post('/gerar-pdf', (req, res) => {
  const { cliente, produtos } = req.body;

  const doc = new PDFDocument({ margin: 40 });
  const nomeArquivo = `orcamento_${Date.now()}.pdf`;
  const caminho = path.join(__dirname, 'public', nomeArquivo);

  doc.pipe(fs.createWriteStream(caminho));

  // Título
  doc.fontSize(22).font('Helvetica-Bold').text('Orçamento', { align: 'center' });
  doc.moveDown(1.5);

  // Dados do cliente
  doc.fontSize(14).font('Helvetica-Bold').text('Dados do Cliente');
  doc.moveDown(0.5);
  doc.fontSize(12).font('Helvetica')
    .text(`Nome: ${cliente.nome}`)
    .text(`Telefone: ${cliente.telefone}`)
    .text(`Email: ${cliente.email}`)
    .text(`Endereço: ${cliente.endereco}`);
  doc.moveDown(1);

  // Linha separadora
  doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
  doc.moveDown(1);

  // Tabela dos produtos
  doc.fontSize(14).font('Helvetica-Bold').text('Itens do Orçamento');
  doc.moveDown(0.5);

  doc.fontSize(12).font('Helvetica-Bold');

  let startY = doc.y;
  doc.text('Produto', 40, startY);
  doc.text('Categoria', 200, startY);
  doc.text('Qtd', 320, startY, { width: 40, align: 'right' });
  doc.text('Valor Unit.', 380, startY, { width: 80, align: 'right' });
  doc.text('Total', 470, startY, { width: 80, align: 'right' });

  doc.moveDown(0.2); // Pequeno espaço depois do cabeçalho
  doc.font('Helvetica');

  let totalGeral = 0;
  let rowY = doc.y;

  // Linhas da tabela
  produtos.forEach(p => {
    const total = p.valor * p.quantidade;
    totalGeral += total;

    doc.text(p.nome, 40, rowY);
    doc.text(p.categoria, 200, rowY);
    doc.text(p.quantidade.toString(), 320, rowY, { width: 40, align: 'right' });
    doc.text(`R$ ${p.valor.toFixed(2)}`, 380, rowY, { width: 80, align: 'right' });
    doc.text(`R$ ${total.toFixed(2)}`, 470, rowY, { width: 80, align: 'right' });

    rowY += 18; // controla a altura entre linhas (ajuste se necessário)
  });

  // Linha separadora antes do total geral
  doc.moveTo(40, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
  doc.moveDown(0.5);
  doc.fontSize(14).font('Helvetica-Bold').text(`Total Geral: R$ ${totalGeral.toFixed(2)}`, { align: 'right' });


  doc.end();

  res.json({ caminho: `/public/${nomeArquivo}` });
});




app.use('/public', express.static(path.join(__dirname, 'public')));

// =========================================================//

app.get('/', (req, res) => {
  res.render('main', { title: 'Página Inicial' });
});


app.get('/estoque', async (req, res) => {
  try {
    const produtos = await Produto.findAll();
    // Converter para JSON simples:
    const produtosJSON = produtos.map(p => p.toJSON());
    res.render('estoque', { produtos: produtosJSON, title: 'Estoque' });
  } catch (error) {
    res.status(500).send('Erro ao buscar produtos: ' + error.message);
  }
});

app.post('/produtos', async (req, res) => {
  try {
    const { nome, categoria, quantidade, valor } = req.body;
    await Produto.create({
      nome,
      categoria,
      quantidade: parseInt(quantidade, 10),
      valor: parseFloat(valor),
    });
    res.redirect('/estoque');
  } catch (error) {
    res.status(500).send('Erro ao cadastrar produto: ' + error.message);
  }
});

app.get('/api/produtos', async (req, res) => {
  try {
    const produtos = await Produto.findAll();
    const produtosJSON = produtos.map(p => p.toJSON());
    res.json(produtosJSON);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar produtos.' });
  }
  console.log(produtosJSON);
});

app.get('/orcamento', async (req, res) => {
  try {
    const produtos = await Produto.findAll();
    const produtosJSON = produtos.map(p => p.toJSON());
    res.render('orcamento', { title: 'Orçamento', produtos: produtosJSON });
  } catch (err) {
    res.status(500).send('Erro ao carregar produtos para o orçamento');
  }
});

app.post('/produtos/novo', async (req, res) => {
  try {
    const { nome, categoria, quantidade, valor } = req.body;
    await Produto.create({
      nome,
      categoria,
      quantidade: parseInt(quantidade, 10),
      valor: parseFloat(valor),
    });
    res.redirect('/estoque');
  } catch (error) {
    res.status(500).send('Erro ao cadastrar produto: ' + error.message);
  }
});

app.get('/produtos/editar/:id', async (req, res) => {
  try {
    const produto = await Produto.findByPk(req.params.id);
    if (!produto) {
      return res.status(404).send('Produto não encontrado');
    }
    res.render('editarProduto', { produto: produto.toJSON(), title: 'Editar Produto' });
  } catch (error) {
    res.status(500).send('Erro ao carregar produto: ' + error.message);
  }
});

app.post('/produtos/editar/:id', async (req, res) => {
  try {
    const { nome, categoria, quantidade, valor } = req.body;
    const produto = await Produto.findByPk(req.params.id);

    if (!produto) {
      return res.status(404).send('Produto não encontrado');
    }

    produto.nome = nome;
    produto.categoria = categoria;
    produto.quantidade = parseInt(quantidade, 10);
    produto.valor = parseFloat(valor);

    await produto.save();

    res.redirect('/estoque');
  } catch (error) {
    res.status(500).send('Erro ao atualizar produto: ' + error.message);
  }
});



// ==========================================================//

// Testar conexão e iniciar servidor
sequelize.sync().then(() => {
  console.log('Conectado e sincronizado com o banco');
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}).catch((err) => {
  console.error('Erro ao conectar ao banco:', err);
});
