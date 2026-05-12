import type { Request, Response } from 'express';
import { EmployeeModel } from '../models/Employee.js';
import { env } from '../config/env.js';

function normalizePeruPhone(raw: string): string | null {
  const digits = (raw ?? '').replace(/\D+/g, '');
  if (!digits) return null;
  if (digits.startsWith('51') && digits.length === 11) return digits;
  if (digits.length === 9) return `51${digits}`;
  if (digits.length === 11 && digits.startsWith('51')) return digits;
  return digits;
}

export async function notifyWhatsappScheduleController(req: Request, res: Response): Promise<void> {
  const { employeeId, weekStart, phoneOverride } = (req.body ?? {}) as {
    employeeId?: string;
    weekStart?: string;
    phoneOverride?: string;
  };

  if (!employeeId || !weekStart) {
    res.status(400).json({ error: 'employeeId y weekStart son requeridos.' });
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    res.status(400).json({ error: 'weekStart inválido. Formato YYYY-MM-DD.' });
    return;
  }

  if (!env.flowWebhookId || !env.flowWebhookSecret) {
    res.status(500).json({ error: 'FLOW_WEBHOOK_ID o FLOW_WEBHOOK_SECRET no configurados en el servidor.' });
    return;
  }

  const employeeDoc = await EmployeeModel.findOne({ baseEmployeeId: employeeId }).lean();
  if (!employeeDoc) {
    res.status(404).json({ error: 'Colaborador no encontrado.' });
    return;
  }
  const data = employeeDoc.data as { id?: string; name?: string; phone?: string };
  const resolvedId = data.id ?? employeeDoc.baseEmployeeId;
  const nombre = data.name ?? '';
  const rawPhone = phoneOverride ?? data.phone ?? '';
  const to = normalizePeruPhone(rawPhone);
  if (!to) {
    res.status(400).json({ error: 'El colaborador no tiene teléfono registrado.' });
    return;
  }

  const url = `${env.flowWebhookBaseUrl.replace(/\/+$/, '')}/${encodeURIComponent(env.flowWebhookId)}`;
  const publicScheduleUrl = `${env.publicAppBaseUrl.replace(/\/+$/, '')}/public/schedule/${encodeURIComponent(resolvedId)}?weekStart=${weekStart}`;
  const payload = {
    to,
    variables: {
      nombre,
      phone: to,
      url: publicScheduleUrl,
      slug: resolvedId,
      weekStart
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Flow-Secret': env.flowWebhookSecret
      },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    if (!response.ok) {
      res.status(response.status).json({ error: 'Falló envío al webhook.', upstream: text });
      return;
    }
    let upstream: unknown = text;
    try {
      upstream = JSON.parse(text);
    } catch {
      // keep as text
    }
    res.status(200).json({ ok: true, to, payload, upstream });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado.';
    res.status(502).json({ error: `No se pudo contactar el webhook: ${message}` });
  }
}
