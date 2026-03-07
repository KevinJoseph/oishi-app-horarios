import { login, logoutByToken } from '../services/auth.service.js';
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
export async function loginController(req, res) {
    try {
        const payload = req.body;
        const result = await login(payload);
        res.status(200).json(result);
    }
    catch (error) {
        res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
    }
}
export async function meController(req, res) {
    const user = req.authUser;
    if (!user) {
        res.status(401).json({ error: 'No autenticado.' });
        return;
    }
    res.status(200).json(user);
}
export async function logoutController(req, res) {
    const token = req.authToken;
    if (!token) {
        res.status(204).end();
        return;
    }
    await logoutByToken(token);
    res.status(204).end();
}
