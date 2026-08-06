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
      '1': nombre,
      '2': publicScheduleUrl,
      '3': resolvedId,
      '4': weekStart,
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

export async function notifyEmailScheduleController(req: Request, res: Response): Promise<void> {
  const { employeeId, weekStart, emailOverride } = (req.body ?? {}) as {
    employeeId?: string;
    weekStart?: string;
    emailOverride?: string;
  };

  if (!employeeId || !weekStart) {
    res.status(400).json({ error: 'employeeId y weekStart son requeridos.' });
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    res.status(400).json({ error: 'weekStart inválido. Formato YYYY-MM-DD.' });
    return;
  }

  if (!env.brevoApiKey) {
    res.status(500).json({ error: 'BREVO_API_KEY no configurado en el servidor.' });
    return;
  }

  const employeeDoc = await EmployeeModel.findOne({ baseEmployeeId: employeeId }).lean();
  if (!employeeDoc) {
    res.status(404).json({ error: 'Colaborador no encontrado.' });
    return;
  }
  const data = employeeDoc.data as { id?: string; name?: string; email?: string; phone?: string };
  const resolvedId = data.id ?? employeeDoc.baseEmployeeId;
  const nombre = data.name ?? '';
  const rawEmail = emailOverride ?? data.email ?? '';
  const toEmail = rawEmail.trim();
  if (!toEmail) {
    res.status(400).json({ error: 'El colaborador no tiene correo registrado.' });
    return;
  }

  const publicScheduleUrl = `${env.publicAppBaseUrl.replace(/\/+$/, '')}/public/schedule/${encodeURIComponent(resolvedId)}?weekStart=${weekStart}`;
  const subject = `Tu planificación semanal - ${weekStart}`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a365d;">Hola ${escapeHtml(nombre || 'colaborador')},</h2>
      <p>Te compartimos tu planificación pública de la semana <strong>${weekStart}</strong>.</p>
      <p>Puedes revisarla en el siguiente enlace:</p>
      <p style="margin: 24px 0;">
        <a href="${publicScheduleUrl}" style="background-color: #1a365d; color: #fff; padding: 12px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Ver planificación
        </a>
      </p>
      <p>O copia y pega este enlace en tu navegador:</p>
      <p style="word-break: break-all; color: #4a5568;">${publicScheduleUrl}</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 12px; color: #718096;">Este mensaje fue generado automáticamente por el sistema de planificación Oishi.</p>
    </div>
  `;
  const textContent = `Hola ${nombre || 'colaborador'},\n\nTe compartimos tu planificación pública de la semana ${weekStart}.\nEnlace: ${publicScheduleUrl}`;

  const brevoPayload = {
    sender: { name: env.brevoSenderName, email: env.brevoSenderEmail },
    to: [{ email: toEmail, name: nombre || undefined }],
    subject,
    htmlContent,
    textContent
  };

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': env.brevoApiKey,
        Accept: 'application/json'
      },
      body: JSON.stringify(brevoPayload)
    });
    const text = await response.text();
    if (!response.ok) {
      res.status(response.status).json({ error: 'Falló envío con Brevo.', upstream: text });
      return;
    }
    let upstream: unknown = text;
    try {
      upstream = JSON.parse(text);
    } catch {
      // keep as text
    }
    res.status(200).json({ ok: true, to: toEmail, payload: brevoPayload, upstream });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado.';
    res.status(502).json({ error: `No se pudo contactar Brevo: ${message}` });
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
