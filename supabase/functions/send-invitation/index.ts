import { withSupabase } from "npm:@supabase/server@^1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL =
  Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";

const APP_URL = "https://alexgasca27-cloud.github.io/finanzas-app/";

interface InvitationPayload {
  email?: string;
  workspace_id?: string;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json(
        { ok: false, message: "Método no permitido." },
        { status: 405 },
      );
    }

    try {
      if (!RESEND_API_KEY) {
        return Response.json(
          { ok: false, message: "Falta configurar RESEND_API_KEY en Secrets." },
          { status: 500 },
        );
      }

      const payload = (await req.json()) as InvitationPayload;
      const email = normalizeEmail(payload.email ?? "");
      const workspaceId = payload.workspace_id?.trim() || "";

      if (!isValidEmail(email)) {
        return Response.json(
          { ok: false, message: "Ingresa un correo electrónico válido." },
          { status: 400 },
        );
      }

      // IMPORTANT: userClaims exposes the authenticated user's `id`.
      // The JWT's `sub` lives in jwtClaims. Using userClaims.id avoids the
      // false "No se pudo identificar al usuario" error.
      const userId = ctx.userClaims?.id;
      const callerEmail = normalizeEmail(ctx.userClaims?.email ?? "");

      if (!userId) {
        return Response.json(
          { ok: false, message: "No se pudo identificar al usuario." },
          { status: 401 },
        );
      }

      if (!workspaceId) {
        return Response.json(
          { ok: false, message: "No se recibió el espacio financiero activo." },
          { status: 400 },
        );
      }

      const { data: workspace, error: workspaceError } = await ctx.supabase
        .from("workspaces")
        .select("id,name,owner_id")
        .eq("id", workspaceId)
        .eq("owner_id", userId)
        .maybeSingle();

      if (workspaceError) {
        console.error("workspace lookup error", workspaceError);
        return Response.json(
          { ok: false, message: "No se pudo comprobar tu espacio compartido." },
          { status: 500 },
        );
      }

      if (!workspace) {
        return Response.json(
          {
            ok: false,
            message:
              "No tienes permisos para enviar invitaciones desde este espacio.",
          },
          { status: 403 },
        );
      }

      if (email === callerEmail) {
        return Response.json(
          {
            ok: false,
            message: "No puedes enviar una invitación a tu propio correo.",
          },
          { status: 400 },
        );
      }

      // Prevent duplicate pending invitations for the same email/workspace.
      const { data: existingInvite, error: existingError } =
        await ctx.supabaseAdmin
          .from("workspace_invitations")
          .select("id,expires_at")
          .eq("workspace_id", workspace.id)
          .eq("invited_email", email)
          .eq("status", "pending")
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();

      if (existingError) {
        console.error("existing invitation lookup error", existingError);
        return Response.json(
          { ok: false, message: "No se pudo comprobar invitaciones existentes." },
          { status: 500 },
        );
      }

      if (existingInvite) {
        return Response.json(
          {
            ok: false,
            message: "Ya existe una invitación pendiente para ese correo.",
          },
          { status: 409 },
        );
      }

      // Generate the invitation token on the server.
      const token = crypto.randomUUID();
      const expiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const { data: invitation, error: invitationError } =
        await ctx.supabaseAdmin
          .from("workspace_invitations")
          .insert({
            workspace_id: workspace.id,
            invited_email: email,
            invited_by: userId,
            status: "pending",
            token,
            expires_at: expiresAt,
          })
          .select("id")
          .single();

      if (invitationError) {
        console.error("invitation insert error", invitationError);
        return Response.json(
          {
            ok: false,
            message:
              "No se pudo crear la invitación. Verifica que la estructura de invitaciones esté actualizada.",
          },
          { status: 500 },
        );
      }

      const inviteUrl = `${APP_URL}?invite=${encodeURIComponent(token)}`;
      const workspaceName = escapeHtml(
        workspace.name ?? "tu espacio compartido",
      );

      const html = `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Invitación a Finanzas App</title>
</head>
<body style="margin:0;padding:0;background:#0b0f0d;font-family:Arial,Helvetica,sans-serif;color:#f4f7f5;">
  <div style="max-width:620px;margin:0 auto;padding:36px 18px;">
    <div style="background:#111714;border:1px solid #24342b;border-radius:18px;padding:32px;">
      <div style="font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:#66ff99;font-weight:700;margin-bottom:14px;">
        Finanzas App
      </div>
      <h1 style="margin:0 0 14px;font-size:30px;line-height:1.15;">
        Te invitaron a un espacio compartido
      </h1>
      <p style="font-size:16px;line-height:1.6;color:#cbd6cf;">
        Has recibido una invitación para unirte a <strong style="color:#fff;">${workspaceName}</strong> en Finanzas App.
      </p>
      <p style="font-size:16px;line-height:1.6;color:#cbd6cf;">
        Al aceptar podrás ver la información marcada como <strong style="color:#fff;">compartida</strong>.
        La información personal de cada integrante permanece privada.
      </p>
      <div style="margin:28px 0;">
        <a href="${inviteUrl}" style="display:inline-block;background:#66ff99;color:#07100b;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:10px;">
          Aceptar invitación
        </a>
      </div>
      <p style="font-size:13px;line-height:1.5;color:#8e9a93;">
        Esta invitación es válida durante 7 días. Si no esperabas este correo, simplemente puedes ignorarlo.
      </p>
      <p style="font-size:12px;line-height:1.5;color:#68756d;margin-top:24px;word-break:break-all;">
        Si el botón no funciona, abre este enlace:<br>
        ${escapeHtml(inviteUrl)}
      </p>
    </div>
  </div>
</body>
</html>`;

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: RESEND_FROM_EMAIL,
          to: [email],
          subject: `Invitación a ${workspace.name ?? "tu espacio"} · Finanzas App`,
          html,
        }),
      });

      const resendData = await resendResponse.json();

      if (!resendResponse.ok) {
        console.error("Resend error", resendData);
        await ctx.supabaseAdmin
          .from("workspace_invitations")
          .update({ status: "cancelled" })
          .eq("id", invitation.id);

        return Response.json(
          {
            ok: false,
            message:
              resendData?.message ?? "Resend rechazó el envío del correo.",
          },
          { status: 502 },
        );
      }

      return Response.json({
        ok: true,
        message: "Invitación enviada correctamente.",
        invitation_id: invitation.id,
        expires_at: expiresAt,
      });
    } catch (error) {
      console.error("send-invitation error", error);
      return Response.json(
        {
          ok: false,
          message:
            error instanceof Error
              ? error.message
              : "Ocurrió un error inesperado.",
        },
        { status: 500 },
      );
    }
  }),
};
