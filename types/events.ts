export type EventStatus = "draft" | "published" | "closed";

export type Event = {
  id: string;
  tenant_id: string;
  name: string;
  status: EventStatus;
  starts_at: string | null;
  ends_at: string | null;
  venue_room_id: string | null;
  venue_room_layout_id: string | null;
  expected_attendance: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type EventFilters = {
  status?: EventStatus;
  roomId?: string;
  fromStartsAt?: string;
  toStartsAt?: string;
  limit?: number;
};

export type CreateEventInput = {
  name: string;
  status?: EventStatus;
  startsAt?: string | null;
  endsAt?: string | null;
  venueRoomId?: string | null;
  venueRoomLayoutId?: string | null;
  expectedAttendance?: number | null;
  createdBy?: string | null;
};

export type UpdateEventInput = {
  name?: string;
  status?: EventStatus;
  startsAt?: string | null;
  endsAt?: string | null;
  venueRoomId?: string | null;
  venueRoomLayoutId?: string | null;
  expectedAttendance?: number | null;
  updatedBy?: string | null;
};
