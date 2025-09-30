import express from 'express';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors({ origin: true, credentials: true }));

app.get('/health', (_req, res) => {
  const hasKey = Boolean(process.env.OPENAI_API_KEY);
  res.json({ ok: true, service: 'gpt-codex', hasOpenAIKey: hasKey });
});

// 개발용 에코 엔드포인트 (추후 OpenAI 연동으로 교체)
app.post('/chat', async (req, res) => {
  res.json({ echo: req.body ?? null });
});

// 환경 변수 체크(민감값 노출 금지)
app.get('/env-check', (_req, res) => {
  const hasKey = Boolean(process.env.OPENAI_API_KEY);
  res.json({ hasOpenAIKey: hasKey });
});

const port = process.env.PORT || 8080;
const host = process.env.HOST || '0.0.0.0';
app.listen(port, host, () => {
  console.log(`gpt-codex listening on http://${host}:${port}`);
});
