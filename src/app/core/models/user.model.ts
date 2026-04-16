export interface Role {
  code: string;
  name: string;
}

export interface Department {
  name: string;
}

export interface Team {
  department: Department;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  team?: Team;
}

export interface AuthResponse {
  data: {
    user: User;
    accessToken: string;
    refreshToken: string;
  };
}
