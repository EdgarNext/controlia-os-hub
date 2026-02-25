export type VenueStatus = "draft" | "active" | "inactive" | "archived" | "canceled";

export type Room = {
  id: string;
  tenant_id: string;
  name: string;
  code: string | null;
  default_capacity: number;
  status: VenueStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type RoomLayout = {
  id: string;
  tenant_id: string;
  room_id: string;
  name: string;
  capacity: number;
  status: VenueStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type Equipment = {
  id: string;
  tenant_id: string;
  name: string;
  equipment_type: string | null;
  status: VenueStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type RoomEquipment = {
  id: string;
  tenant_id: string;
  room_id: string;
  equipment_id: string;
  quantity: number;
  status: VenueStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type CreateRoomInput = {
  name: string;
  code?: string | null;
  defaultCapacity: number;
  status?: VenueStatus;
  createdBy?: string | null;
};

export type UpdateRoomInput = {
  name?: string;
  code?: string | null;
  defaultCapacity?: number;
  status?: VenueStatus;
  updatedBy?: string | null;
};

export type EquipmentInput = {
  name: string;
  equipmentType?: string | null;
  status?: VenueStatus;
  actorUserId?: string | null;
};

export type UpdateEquipmentInput = {
  name?: string;
  equipmentType?: string | null;
  status?: VenueStatus;
  actorUserId?: string | null;
};
