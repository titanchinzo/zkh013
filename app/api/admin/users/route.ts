import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getCurrentRole } from "@/lib/auth-role";
import { personnelLabel } from "@/lib/hr";
import { clerkErrorMessage, parseEmail } from "@/lib/invite";
import { connectToDatabase } from "@/lib/mongodb";
import Personnel from "@/lib/models/Personnel";
import { isRole, resolveRole } from "@/lib/roles";

const FORBIDDEN = { error: "Зөвшөөрөлгүй" };

type PersonDoc = { userId: string; rank: string; name: string; position?: string; group?: string; active: boolean };

/**
 * Хэрэглэгчид, хүлээгдэж буй урилгууд. Нэр нь алба хаагчийн бүртгэлээс (цол, нэр — хүний нөөцийн бичсэнээр); бүртгэлгүй
 * (утсаа бүртгүүлээгүй) хүнийх Clerk-ийн нэрээр. unit — бүлэг эсвэл албан тушаал.
 */
export async function GET() {
  const role = await getCurrentRole();
  if (role !== "admin") {
    return NextResponse.json(FORBIDDEN, { status: 403 });
  }

  const client = await clerkClient();
  const [{ data }, { data: pending }, { userId }] = await Promise.all([
    client.users.getUserList({ limit: 500, orderBy: "-created_at" }),
    client.invitations.getInvitationList({ status: "pending", limit: 100 }),
    auth(),
  ]);

  await connectToDatabase();
  const people = await Personnel.find({ userId: { $in: data.map((u) => u.id) } })
    .select("userId rank name position group active")
    .lean<PersonDoc[]>();
  const personOf = new Map(people.map((p) => [p.userId, p]));

  const users = data.map((u) => {
    const person = personOf.get(u.id);
    return {
      id: u.id,
      name: person ? personnelLabel(person) : (u.fullName ?? u.username ?? ""),
      unit: person ? person.group || person.position || "" : "",
      registered: Boolean(person),
      inactive: Boolean(person && !person.active),
      email: u.primaryEmailAddress?.emailAddress ?? "",
      role: resolveRole(u.publicMetadata as { role?: string }, u.primaryEmailAddress?.emailAddress),
      banned: u.banned,
      lastSignInAt: u.lastSignInAt,
      isMe: u.id === userId,
    };
  });

  // Урилга илгээсэн боловч хараахан бүртгүүлээгүй хүмүүс
  const invitations = pending.map((inv) => {
    const invitedRole = inv.publicMetadata?.role;
    return { id: inv.id, email: inv.emailAddress, role: isRole(invitedRole) ? invitedRole : null, createdAt: inv.createdAt };
  });

  return NextResponse.json({ users, invitations });
}

/**
 * Хэрэглэгчийг шууд нэмнэ (урилгагүй). body: { email, role } — role "none" бол эрхгүй (утасны апп ашиглагч).
 * Нууц үг шаардахгүй: тэр хүн /app дээр «Нэвтрэх» дараад и-мэйлээ бичиж, ирсэн кодоор нэвтэрч, бүртгэлээ шууд
 * үүсгэнэ (админ нэмсэн тул хүний нөөцийн зөвшөөрөл хэрэггүй).
 */
export async function POST(req: NextRequest) {
  if ((await getCurrentRole()) !== "admin") return NextResponse.json(FORBIDDEN, { status: 403 });
  const body = await req.json().catch(() => null);
  const email = parseEmail(body?.email);
  if (!email) return NextResponse.json({ error: "И-мэйл хаяг буруу байна." }, { status: 400 });
  if (body?.role !== "none" && !isRole(body?.role)) {
    return NextResponse.json({ error: "Эрхээ сонгоно уу." }, { status: 400 });
  }

  const invitedBy = (await auth()).userId ?? "";
  const client = await clerkClient();
  try {
    await client.users.createUser({
      emailAddress: [email],
      publicMetadata: body.role === "none" ? { invitedBy } : { role: body.role, invitedBy },
      skipPasswordRequirement: true,
    });
  } catch (err) {
    const error = clerkErrorMessage(err, "Хэрэглэгч нэмж чадсангүй");
    if (error) return NextResponse.json({ error }, { status: 400 });
    throw err;
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
