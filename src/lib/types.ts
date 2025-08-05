// This is a new file you need to create.

export interface Document {
    id: string;
    userId: string;
    fileName: string;
    pdfUrl: string;
    audioUrl: string | null;
    zoomLevel: number;
    createdAt: string; 
  }
  
  export interface User {
    id: string;
    name: string;
    email: string;
    password: string; // This is the hashed password
    isAdmin: boolean;
    createdAt: string; 
  }