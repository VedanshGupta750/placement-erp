import { z } from "zod";

export const sendMessageSchema = z.object({
  conversationId: z.string().optional(),
  recipientUserId: z.string().optional(),
  body: z.string().trim().min(1, "Message can't be empty."),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name can't be empty."),
  participantUserIds: z.array(z.string()).min(1, "Add at least one other participant."),
  body: z.string().trim().min(1, "Message can't be empty."),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const starConversationSchema = z.object({
  starred: z.boolean(),
});
export type StarConversationInput = z.infer<typeof starConversationSchema>;

// null clears the link.
export const linkDriveSchema = z.object({
  driveId: z.string().trim().min(1).nullable(),
});
export type LinkDriveInput = z.infer<typeof linkDriveSchema>;

export const addParticipantsSchema = z.object({
  userIds: z.array(z.string()).min(1, "Pick at least one person to add."),
});
export type AddParticipantsInput = z.infer<typeof addParticipantsSchema>;

export const createDraftSchema = z.object({
  body: z.string().trim().min(1, "Draft can't be empty."),
  remindAt: z
    .string()
    .optional()
    .nullable()
    .refine((v) => {
      if (!v) return true;
      const d = new Date(v);
      return !Number.isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2100;
    }, "Enter a valid reminder date."),
});
export type CreateDraftInput = z.infer<typeof createDraftSchema>;
