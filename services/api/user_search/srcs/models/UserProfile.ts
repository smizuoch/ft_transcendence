export interface UserProfile {
  user_name: string;
  profile_image: string;
  is_online: boolean;
}

export interface UserProfileResponse {
  success: boolean;
  data?: {
    username: string;
    profileImage: string;
    isOnline: boolean;
  };
  error?: string;
}
