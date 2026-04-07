import { ApiError } from './http';

export const TICKETS_API_URL = import.meta.env.VITE_TICKETS_API_URL ?? 'http://localhost:5000/api/tickets';

export type CreateTicketPayload = {
  application: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  subject: string;
  description: string;
};

export type TicketResponse = CreateTicketPayload & {
  status?: string;
  _id?: string;
  createdAt?: string;
  updatedAt?: string;
  __v?: number;
};

function parseErrorMessage(raw: string): string {
  if (!raw) return 'No se pudo registrar la incidencia.';

  try {
    const parsed = JSON.parse(raw) as { error?: string; message?: string };
    return parsed.error ?? parsed.message ?? raw;
  } catch {
    return raw;
  }
}

export async function createTicket(payload: CreateTicketPayload): Promise<TicketResponse> {
  const response = await fetch(TICKETS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, parseErrorMessage(text));
  }

  return (await response.json()) as TicketResponse;
}
