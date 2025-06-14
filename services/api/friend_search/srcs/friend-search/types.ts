export interface UserProfile {
  username: string;
  profileImage: string;
  isOnline: boolean;
}

export interface FriendshipStatus {
  isFollowing: boolean;
  isFollowedBy: boolean;
  isMutual: boolean;
}
