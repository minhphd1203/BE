import { Inspection, NewInspection } from '../db/schema';

// API Response types
export interface InspectionResponse {
  success: boolean;
  data?: Inspection | Inspection[];
  message?: string;
}

// Inspection form data
export interface InspectionFormData {
  bikeId: string;
  status: 'passed' | 'failed';
  overallCondition: 'excellent' | 'good' | 'fair' | 'poor';
  frameCondition?: string;
  brakeCondition?: string;
  drivetrainCondition?: string;
  wheelCondition?: string;
  inspectionNote?: string;
  recommendation?: string;
  inspectionImages?: string[];
  reportFile?: string;
}

// Dashboard statistics
export interface InspectorDashboard {
  pendingInspections: number;
  completedInspections: number;
  passedCount: number;
  failedCount: number;
  disputesCount: number;
}

// Bike with inspection details
export interface BikeWithInspection {
  id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  condition: string;
  images: string[];
  status: string;
  isVerified: string;
  inspectionStatus: string;
  sellerId: string;
  sellerName?: string;
  categoryName?: string;
  createdAt: Date;
  latestInspection?: Inspection;
}

export type { Inspection, NewInspection };
