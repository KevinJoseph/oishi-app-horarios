import { adminResetPassword, changePassword, login, logoutByToken, requestPasswordReset, resetPassword } from '../services/auth.service.js';
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
export async function changePasswordController(req, res) {
    const user = req.authUser;
    const token = req.authToken;
    if (!user || !token) {
        res.status(401).json({ error: 'No autenticado.' });
        return;
    }
    try {
        const payload = req.body;
        await changePassword(user.id, token, payload);
        res.status(200).json({ message: 'Contraseña actualizada correctamente.' });
    }
    catch (error) {
        res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
    }
}
export async function forgotPasswordController(req, res) {
    try {
        const payload = req.body;
        const result = await requestPasswordReset(payload);
        res.status(200).json(result);
    }
    catch (error) {
        res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
    }
}
export async function adminResetPasswordController(req, res) {
    try {
        const payload = req.body;
        await adminResetPassword(payload);
        res.status(200).json({ message: 'Contraseña restablecida correctamente.' });
    }
    catch (error) {
        res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
    }
}
export async function resetPasswordController(req, res) {
    try {
        const payload = req.body;
        await resetPassword(payload);
        res.status(200).json({ message: 'Contraseña restablecida correctamente.' });
    }
    catch (error) {
        res.status(resolveStatus(error)).json({ error: resolveMessage(error) });
    }
}
