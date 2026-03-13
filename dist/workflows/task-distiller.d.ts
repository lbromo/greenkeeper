import { z } from 'zod';
/**
 * Task Distiller Output Schema
 * Strictly following the blood-brain barrier policy.
 */
export declare const DistilledTaskSchema: z.ZodObject<{
    tasks: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        description: z.ZodString;
        urgency: z.ZodEnum<{
            low: "low";
            normal: "normal";
            high: "high";
        }>;
        actionable: z.ZodBoolean;
        source_message_id: z.ZodString;
    }, z.core.$strip>>;
    summary: z.ZodString;
}, z.core.$strip>;
export type DistilledTaskSummary = z.infer<typeof DistilledTaskSchema>;
/**
 * Distills actionable tasks from raw Teams messages using Azure AI Foundry (Anthropic).
 */
export declare function distillTasks(messages: any[]): Promise<DistilledTaskSummary>;
