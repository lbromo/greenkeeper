import { OpenAIClient, AzureKeyCredential } from "@azure/openai";
import { z } from 'zod';

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
 * Distills actionable tasks from raw Teams messages using Azure AI Foundry.
 */
export async function distillTasks(messages: any[]): Promise<DistilledTaskSummary> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
  const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o';

  if (!endpoint || !azureApiKey) {
    console.warn('⚠️ Missing Azure OpenAI configuration. Returning empty task list.');
    return { tasks: [], summary: "Azure OpenAI not configured." };
  }

  // @ts-ignore - OpenAIClient exists in this beta version
  const client = new OpenAIClient(endpoint, new AzureKeyCredential(azureApiKey));

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
    const result = await client.getChatCompletions(deploymentName, [
      { role: "system", content: "You are a professional task assistant. You always output valid JSON." },
      { role: "user", content: prompt }
    ], {
      // @ts-ignore - responseFormat is supported in newer models/SDKs
      responseFormat: { type: 'json_object' }
    });

    const content = result.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from Azure OpenAI');
    }

    const parsed = JSON.parse(content);
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
