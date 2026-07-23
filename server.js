
import express from 'express';
import fetch from 'node-fetch';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const BFF_LOGIN_URL = 'https://sedintegracoes.educacao.sp.gov.br/saladofuturobffapi/credenciais/api/LoginCompletoToken';
const BFF_KEY = 'd701a2043aa24d7ebb37e9adf60d043b';
const IPTV_TOKEN_URL = 'https://edusp-api.ip.tv/registration/edusp/token';
const IPTV_BASE = 'https://edusp-api.ip.tv';

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

function randHex(n) {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function iptvHeaders(authToken = null) {
  const rid = randHex(32);
  const par = randHex(16);
  const h = {
    'Accept': '*/*',
    'Accept-Language': 'pt-BR,pt;q=0.9',
    'Content-Type': 'application/json',
    'Request-Id': `|${rid}.${par}`,
    'Traceparent': `00-${rid}-${par}-01`,
    'X-Api-Realm': 'edusp',
    'X-Api-Platform': 'webclient',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };
  if (authToken) h['X-Api-Key'] = authToken;
  return h;
}

app.get('/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

app.post('/api/login', async (req, res) => {
  try {
    const { ra, digito, senha } = req.body;
    if (!ra || !digito || !senha) return res.status(400).json({ error: 'Faltam dados.' });

    const userKey = `${ra.padStart(12, '0')}${digito}SP`;
    
    // Step 1: SED/BFF
    const bffResp = await fetch(BFF_LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ocp-apim-subscription-key': BFF_KEY,
        'User-Agent': 'Mozilla/5.0',
        'Origin': 'https://saladofuturo.educacao.sp.gov.br',
        'Referer': 'https://saladofuturo.educacao.sp.gov.br/',
      },
      body: JSON.stringify({ user: userKey, senha, tipo: 'ALUNO' }),
    });

    if (!bffResp.ok) return res.status(401).json({ error: 'Credenciais inválidas ou erro SED.' });
    
    const bffData = await bffResp.json();
    const sedToken = bffData.token;

    // Step 2: IPTV
    const iptvResp = await fetch(IPTV_TOKEN_URL, {
      method: 'POST',
      headers: iptvHeaders(),
      body: JSON.stringify({ token: sedToken }),
    });

    if (!iptvResp.ok) return res.status(500).json({ error: 'Erro ao obter token IPTV.' });
    
    const iptvData = await iptvResp.json();
    res.json({
      authToken: iptvData.auth_token,
      aluno: { nome: iptvData.name, ra, digito }
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' });
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, '0.0.0.0', () => console.log('Server is UP'));
