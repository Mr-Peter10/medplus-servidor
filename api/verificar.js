// medplus-servidor/api/verificar.js
// ─────────────────────────────────────────────────────────
// Endpoint público: verifica se o machineCode tem licença activa
// GET /api/verificar?machineCode=MP-XXXX-XXXX-XXXX
// ─────────────────────────────────────────────────────────
const crypto = require('crypto');

// ⚠️ DEVE SER IGUAL AO licenca.service.js DO ELECTRON
const SECRET = 'ndozera10.';

// ═══════════════════════════════════════════════════════
// BASE DE DADOS DE CLIENTES
// Para adicionar um cliente novo, basta adicionar uma linha
// neste array e fazer commit no GitHub — Vercel actualiza em 30s
// ═══════════════════════════════════════════════════════
const LICENCAS = [
  // Exemplo (descomenta e preenche para activar um cliente):
   {
     machineCode:    'MP-XXXX-XXXX-XXXX',  // código do PC do cliente
     farmacia:       'Boa Vida',    // nome da farmácia
     sistema:        'farmacia',
     plano:          'anual',              // mensal | bimestral | anual | vitalicio
     dataExpiracao:  '2027-06-01',          // YYYY-MM-DD (ignorado se vitalicio)
     ativo:          true,                  // false = bloquear imediatamente
   },

  {
     machineCode:    'MP-5661-081D-F799',  // código do PC do cliente
     farmacia:       'Teste meu pc',    // nome da farmácia
     sistema:        'farmacia',
     plano:          'mensal',              // mensal | bimestral | anual | vitalicio
     dataExpiracao:  '2026-06-27',          // YYYY-MM-DD (ignorado se vitalicio)
     ativo:          true,                  // false = bloquear imediatamente
   },
];

module.exports = (req, res) => {
  // Permitir CORS (necessário para o Electron aceder)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).json({ ok: false, erro: 'Método não permitido' });

  const { machineCode , sistema } = req.query;
  if (!machineCode) return res.status(400).json({ ok: false, erro: 'machineCode obrigatório' });

  if(!sistema) return res.json({ok:false , erro:'Sistema Obrigatório'})
  
  const mc = machineCode.trim().toUpperCase();

  // Procurar licença activa para este machineCode
  const licenca = LICENCAS.find(l => l.machineCode.toUpperCase() === mc && l.sistema === sistema && l.ativo);

  if (!licenca) {
    return res.json({ ok: false, erro: 'Sem licença activa para este dispositivo. Contacte o suporte MedPlus.' });
  }

  // Verificar se não expirou (excepto vitalício)
  if (licenca.plano !== 'vitalicio') {
    const [ano, mes, dia] = licenca.dataExpiracao.split('-').map(Number);
    const expira = new Date(ano, mes - 1, dia, 0, 0, 0);
    const hoje   = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (expira < hoje) {
      return res.json({ ok: false, erro: `Licença expirada em ${licenca.dataExpiracao}. Contacte o suporte MedPlus apôs a expiração.` });
    }
  }

  // Gerar token HMAC — mesmo formato que o sistema offline
  // O cliente verifica este token localmente com a mesma lógica
  const id      = mc.replace(/MP-|-/g, '');
  const payload = id + '|' + licenca.plano + '|' + licenca.dataExpiracao;
  const hash    = crypto.createHmac('sha256', SECRET).update(payload).digest('hex').toUpperCase();
  const token   = hash.slice(0,4)+'-'+hash.slice(4,8)+'-'+hash.slice(8,12)+'-'+hash.slice(12,16);

  return res.json({
    ok:            true,
    plano:         licenca.plano,
    dataExpiracao: licenca.dataExpiracao,
    farmacia:      licenca.farmacia,
    token,
  });
};
