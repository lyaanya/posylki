import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { DirectoriesModule } from "../directories/directories.module.js";
import { AVATAR_STORAGE } from "./avatar-storage.js";
import { SupabaseAvatarStorage } from "./avatar-storage.supabase.js";
import { ProfileController } from "./profile.controller.js";
import { PROFILE_REPOSITORY } from "./profile.repository.js";
import { SupabaseProfileRepository } from "./profile.repository.supabase.js";

@Module({
  imports: [DirectoriesModule, AuthModule],
  controllers: [ProfileController],
  providers: [
    { provide: PROFILE_REPOSITORY, useClass: SupabaseProfileRepository },
    { provide: AVATAR_STORAGE, useClass: SupabaseAvatarStorage },
  ],
  exports: [PROFILE_REPOSITORY],
})
export class ProfileModule {}
