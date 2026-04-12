import { createUser, deleteUser, listUsers, updateUser, validateCellphoneExists } from '../services/user.service.js';
import { HttpError } from '../utils/httpError.js';
function resolveStatus(error) {
    if (error instanceof HttpError) {
        return error.statusCode;
    }
    return 500;
}
function resolveMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    return 'Error inesperado.';
}
export async function listUsersController(_req, res) {
    try {
        const users = await listUsers();
        res.status(200).json(users);
    }
    catch (error) {
        res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
    }
}
export async function createUserController(req, res) {
    try {
        const payload = req.body;
        const created = await createUser(payload);
        res.status(201).json(created);
    }
    catch (error) {
        res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
    }
}
export async function updateUserController(req, res) {
    const actorId = req.authUser?.id;
    if (!actorId) {
        res.status(401).json({ error: 'No autenticado.' });
        return;
    }
    try {
        const payload = req.body;
        const userId = String(req.params.id);
        const updated = await updateUser(userId, payload, actorId);
        res.status(200).json(updated);
    }
    catch (error) {
        res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
    }
}
export async function deleteUserController(req, res) {
    const actorId = req.authUser?.id;
    if (!actorId) {
        res.status(401).json({ error: 'No autenticado.' });
        return;
    }
    try {
        const userId = String(req.params.id);
        await deleteUser(userId, actorId);
        res.status(204).end();
    }
    catch (error) {
        res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
    }
}
export async function validateCellphoneController(req, res) {
    try {
        const payload = req.body;
        const result = await validateCellphoneExists(payload.celular ?? '');
        res.status(200).json({
            exists: result.exists,
            userId: result.userId,
            message: result.exists ? 'Celular válido' : 'Celular no registrado'
        });
    }
    catch (error) {
        res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
    }
}
