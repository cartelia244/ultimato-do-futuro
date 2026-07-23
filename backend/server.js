const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Login BFF: Apenas troca RA/Senha pelo Token da SED
app.post('/api/login', async (req, res) => {
  const { ra, digito, senha } = req.body;
  try {
    const response = await axios.post('https://saladofuturo.educacao.sp.gov.br/api/login', {
      login: ra,
      digito: digito,
      senha: senha
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.data && response.data.token) {
      // Retorna apenas o token SED para o frontend fazer o resto
      return res.json({ sedToken: response.data.token });
    }
    res.status(401).json({ error: 'RA ou Senha incorretos.' });
  } catch (error) {
    console.error('Erro no Login SED:', error.message);
    res.status(500).json({ error: 'Falha na comunicação com a Secretaria.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
