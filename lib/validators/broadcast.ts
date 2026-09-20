import { z } from "zod";

export const createTemplateSchema = z.object({
  name: z.string().trim().min(2),
  subject: z.string().trim().min(2),
  body: z.string().trim().min(1),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export const createBroadcastSchema = z
  .object({
    subject: z.string().trim().min(2),
    body: z.string().trim().min(1),
    audienceType: z.enum(["ALL_STUDENTS", "ALL_STAFF", "BATCH", "DEPARTMENT", "COURSE", "ROLE"]),
    audienceBatchId: z.string().optional(),
    audienceDepartmentId: z.string().optional(),
    audienceCourseId: z.string().optional(),
    audienceRole: z.string().optional(),
  })
  .refine((v) => v.audienceType !== "BATCH" || !!v.audienceBatchId, { message: "audienceBatchId is required", path: ["audienceBatchId"] })
  .refine((v) => v.audienceType !== "DEPARTMENT" || !!v.audienceDepartmentId, { message: "audienceDepartmentId is required", path: ["audienceDepartmentId"] })
  .refine((v) => v.audienceType !== "COURSE" || !!v.audienceCourseId, { message: "audienceCourseId is required", path: ["audienceCourseId"] })
  .refine((v) => v.audienceType !== "ROLE" || !!v.audienceRole, { message: "audienceRole is required", path: ["audienceRole"] });
