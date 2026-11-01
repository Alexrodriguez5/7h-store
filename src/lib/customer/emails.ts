import { deliver } from "@/lib/mailer";

const q = (o: Record<string, string>) => new URLSearchParams(o).toString();

export const verifyEmail = (to: string, name: string, token: string) =>
  deliver({
    to, kind: "account.verify", subject: "Confirma tu correo · 7H STORE", heading: `Hola ${name}, confirma tu correo`,
    paragraphs: ["Gracias por crear tu cuenta en 7H STORE. Confirma tu correo para ver tus pedidos y solicitudes.", "El enlace vence en 24 horas. Si no fuiste tú, ignora este mensaje."],
    cta: { label: "Confirmar mi correo", path: `/api/cuenta/verificar?${q({ email: to, token })}` },
  });

export const resetEmail = (to: string, token: string) =>
  deliver({
    to, kind: "account.reset", subject: "Restablece tu contraseña · 7H STORE", heading: "Restablece tu contraseña",
    paragraphs: ["Recibimos una solicitud para cambiar la contraseña de tu cuenta.", "El enlace vence en 30 minutos y solo sirve una vez. Si no fuiste tú, ignora este correo: tu contraseña no cambiará."],
    cta: { label: "Crear nueva contraseña", path: `/cuenta/restablecer?${q({ email: to, token })}` },
  });

export const otpEmail = (to: string, code: string) =>
  deliver({
    to, kind: "account.otp", subject: `${code} es tu código de acceso · 7H STORE`, heading: "Tu código de acceso",
    paragraphs: ["Escribe este código en la tienda para entrar a tu cuenta. Vence en 10 minutos.", "Nunca te lo pediremos por teléfono ni por chat. Si no lo solicitaste, ignora este correo."],
    highlight: code,
  });

export const alreadyRegisteredEmail = (to: string) =>
  deliver({
    to, kind: "account.exists", subject: "Ya tienes una cuenta · 7H STORE", heading: "Ya tienes una cuenta con este correo",
    paragraphs: ["Alguien intentó registrarse con tu correo. Si fuiste tú, simplemente inicia sesión (o entra con un código al correo)."],
    cta: { label: "Iniciar sesión", path: "/cuenta" },
  });

export const welcomeEmail = (to: string, name: string) =>
  deliver({
    to, kind: "account.welcome", subject: "Bienvenido a 7H STORE", heading: `¡Bienvenido, ${name}!`,
    paragraphs: ["Tu cuenta está lista. Desde «Mi cuenta» puedes ver todos tus pedidos (también los que hiciste como invitado con este correo), sus envíos y tus solicitudes."],
    cta: { label: "Ver mis pedidos", path: "/cuenta/pedidos" },
  });
