export type Role = 'csp' | 'senior' | 'manager' | 'associe';

export type Moi = {
  id: string;
  prenom: string;
  nom: string;
  trigramme: string;
  role: Role;
  administrateur: boolean;
};
