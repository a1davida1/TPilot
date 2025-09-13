export interface UserData {
  id: number;
  username: string;
  email: string;
  tier: string;
  createdAt: string;
  trialEndsAt?: string;
  // add additional fields as required
}