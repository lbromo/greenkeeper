import { z } from 'zod';
import { distillTasksOllama } from './ollama-provider.js';

/**
 * Task Distiller Output Schema
 * Strictly following the blood-brain barrier policy.
 */
export const DistilledTaskSchema = z.object({
  tasks: z.array(z.object({
    title: z.string().describe("A concise summary of the task"),
    description: z.string().describe("Detailed context of the task (sanitized)"),
    urgency: z.enum(['low', 'normal', 'high']),
    actionable: z.boolean().describe("Whether this requires a specific action"),
    source_message_id: z.string().describe("Original ID of the message this was derived from")
  })),
  summary: z.string().describe("A brief 1-2 sentence overview of the distilled items")
});

export type DistilledTaskSummary = z.infer<typeof DistilledTaskSchema>;

/**
 * Distills actionable tasks from raw Teams messages using configured provider.
 * Supports Azure Anthropic (default) or Ollama (dev).
 */
export async function distillTasks(messages: any[]): Promise<DistilledTaskSummary> {
  const provider = process.env.LLM_PROVIDER || 'anthropic';
  
  if (provider === 'ollama') {
    return distillTasksOllama(messages);
  }

  const endpoint = process.env.AZURE_ANTHROPIC_ENDPOINT || "https://appliedcontrol-resource.services.ai.azure.com/anthropic/v1/messages";
  const azureApiKey = process.env.AZURE_ANTHROPIC_API_KEY;

  if (!azureApiKey) {
    console.warn('⚠️ Missing Azure Anthropic configuration. Returning empty task list.');
    return { tasks: [], summary: "Azure Anthropic not configured." };
  }

  const prompt = `
You are the Task Distiller for Project Greenkeeper.
Your goal is to extract actionable tasks from the provided Teams messages.

CRITICAL POLICY: Blood-Brain Barrier
- ✅ Extract full text summaries, task names, status updates.
- ✅ Anonymize or generalize references where appropriate.
- ❌ NO source code, credentials, API keys, or tokens.
- ❌ NO raw data exports or identifiable customer data.

Output strictly in JSON format matching this structure:
{
  "tasks": [
    {
      "title": "Short title",
      "description": "Sanitized description",
      "urgency": "low|normal|high",
      "actionable": true|false,
      "source_message_id": "id"
    }
  ],
  "summary": "Brief overall summary"
}

Input messages:
${JSON.stringify(messages, null, 2)}
`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${azureApiKey}`,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: prompt }
        ],
        system: "You are a professional task assistant. You always output valid JSON.",
        max_tokens: 4096,
        model: "claude-opus-4-6"
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure Anthropic API error (${response.status}): ${errorText}`);
    }

    const result: any = await response.json();
    const content = result.content?.[0]?.text;
    
    if (!content) {
      throw new Error('Empty response from Azure Anthropic');
    }

    // Anthropic sometimes wraps JSON in markdown blocks
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const cleanedContent = jsonMatch ? jsonMatch[0] : content;

    const parsed = JSON.parse(cleanedContent);
    const validated = DistilledTaskSchema.parse(parsed);
    return validated;
  } catch (error: any) {
    console.error('❌ Task Distillation failed:', error.message);
    return {
      tasks: [],
      summary: `Failed to distill tasks: ${error.message}`
    };
  }
}
