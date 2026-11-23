export type Role = 'STUDENT' | 'WARDEN' | 'ADMIN';

export interface Hostel {
  id: string;
  name: string;
  code: string;
}

export interface WardenAssignment {
  id: string;
  hostelId: string;
  buildingBlock: string | null;
  hostel?: Hostel;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  studentId?: string | null;
  roomNumber?: string | null;
  hostelId: string;
  hostel?: Hostel;
  wardenAssignments?: WardenAssignment[];
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
