import { Module } from "@nestjs/common";
import { ListingsModule } from "../listings/listings.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { CHAT_ATTACHMENT_STORAGE } from "./chat-attachment-storage.js";
import { SupabaseChatAttachmentStorage } from "./chat-attachment-storage.supabase.js";
import { ChatController } from "./chat.controller.js";
import { CHAT_REPOSITORY } from "./chat.repository.js";
import { SupabaseChatRepository } from "./chat.repository.supabase.js";

@Module({
  imports: [ListingsModule, NotificationsModule],
  controllers: [ChatController],
  providers: [
    { provide: CHAT_REPOSITORY, useClass: SupabaseChatRepository },
    { provide: CHAT_ATTACHMENT_STORAGE, useClass: SupabaseChatAttachmentStorage },
  ],
  exports: [CHAT_REPOSITORY],
})
export class ChatModule {}
