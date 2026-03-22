import { z } from "zod/v4";

const StdioTransportSchema = z.object({
  type: z.literal("stdio"),
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  cwd: z.string().optional(),
});

const SseTransportSchema = z.object({
  type: z.literal("sse"),
  url: z.url(),
  headers: z.record(z.string(), z.string()).optional(),
});

const StreamableHttpTransportSchema = z.object({
  type: z.literal("streamable-http"),
  url: z.url(),
  headers: z.record(z.string(), z.string()).optional(),
});

const TransportConfigSchema = z.discriminatedUnion("type", [
  StdioTransportSchema,
  SseTransportSchema,
  StreamableHttpTransportSchema,
]);

const DownstreamServerConfigSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean(),
  transport: TransportConfigSchema,
});

export const SkillManagementConfigSchema = z.object({
  version: z.literal("1.0"),
  gateway: z.object({
    autoStart: z.boolean(),
  }),
  servers: z.record(z.string(), DownstreamServerConfigSchema),
  skills: z.object({
    directory: z.string(),
  }),
});

export type ValidatedConfig = z.infer<typeof SkillManagementConfigSchema>;
