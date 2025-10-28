import { AzureOpenAI } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2023-12-01-preview',
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
});

export default openai;
