import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const BFF_KEY = process.env.BFF_KEY || 'd701a2043aa24d7ebb37e9adf60d043b';
const BFF_LOGIN_URL = 'https://sedintegracoes.educacao.sp.gov.br/saladofuturobffapi/credenciais/api/LoginCompletoToken';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

function formatUserKey(ra, digito) {
  const raPad = ra.toString().replace(/\D/g, '').padStart(12, '0');
  return `${raPad}${digito}SP`;
}

// ─── ROTA: BFF LOGIN (protege a subscription key) ────────────────────────────
// Recebe {ra, digito, senha}
// Devolve {sedToken} para o browser finalizar o exchange com IP.TV diretamente
// (IP.TV tem CORS aberto - não precisa passar pelo servidor)

app.post('/api/login', async (req, res) => {
  try {
    const { ra, digito, senha } = req.body;
    if (!ra || !digito || !senha) {
      return res.status(400).json({ error: 'RA, dígito e senha são obrigatórios.' });
    }

    const userKey = formatUserKey(ra, digito);
    console.log(`[login] userKey=${userKey}`);

    let bffResp;
    try {
      bffResp = await fetch(BFF_LOGIN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ocp-apim-subscription-key': BFF_KEY,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Origin': 'https://saladofuturo.educacao.sp.gov.br',
          'Referer': 'https://saladofuturo.educacao.sp.gov.br/',
        },
        body: JSON.stringify({ user: userKey, senha, tipo: 'ALUNO' }),
        timeout: 20000,
      });
    } catch (err) {
      console.error('[login] BFF request failed:', err.message);
      return res.status(502).json({ error: 'Não foi possível conectar com o servidor da Sala do Futuro. Tente novamente.' });
    }

    if (!bffResp.ok) {
      const errText = await bffResp.text();
      console.error(`[login] BFF error ${bffResp.status}: ${errText.slice(0, 200)}`);
      const msg = (errText.toLowerCase().includes('incorretos') || errText.toLowerCase().includes('invalid') || bffResp.status === 401)
        ? 'RA, dígito ou senha incorretos.'
        : `Erro ao autenticar (${bffResp.status}). Verifique seus dados.`;
      return res.status(401).json({ error: msg });
    }

    const bffData = await bffResp.json();
    const sedToken = bffData.token;
    if (!sedToken) {
      console.error('[login] BFF retornou sem token:', JSON.stringify(bffData).slice(0, 200));
      return res.status(401).json({ error: 'RA, dígito ou senha incorretos.' });
    }

    console.log(`[login] BFF OK, sedToken ${sedToken.length} chars`);

    return res.json({ sedToken, ra, digito, userKey });

  } catch (err) {
    console.error('[login] unexpected error:', err);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────

app.get('/health', (_, res) => res.json({ status: 'ok', ts: Date.now() }));

// ─── SPA FALLBACK ─────────────────────────────────────────────────────────────

app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Ultimato do Futuro rodando na porta ${PORT}`);
});
