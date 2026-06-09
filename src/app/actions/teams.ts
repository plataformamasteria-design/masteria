"use server"

import { db } from "@/lib/db";
import { teams, usersToTeams, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuthOr401 } from "@/lib/api-auth-helper";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const TeamCreateSchema = z.object({
    name: z.string().min(1, "Nome obrigatório").max(100, "Nome muito longo"),
    description: z.string().max(255).optional().default(""),
});

const TeamUpdateSchema = z.object({
    name: z.string().min(1, "Nome obrigatório").max(100).optional(),
    description: z.string().max(255).optional(),
    active: z.boolean().optional(),
});

export async function getTeams() {
    const auth = await requireAuthOr401();
    if ('status' in auth) throw new Error("Unauthorized");

    const result = await db.select().from(teams).where(eq(teams.companyId, auth.companyId));
    return JSON.parse(JSON.stringify(result));
}

export async function getCompanyUsers() {
    const auth = await requireAuthOr401();
    if ('status' in auth) throw new Error("Unauthorized");
    const usersData = await db.select({ 
        id: users.id, 
        name: users.name, 
        email: users.email, 
        role: users.role, 
        avatarUrl: users.avatarUrl,
        emailVerified: users.emailVerified,
        permissions: users.permissions
    }).from(users).where(eq(users.companyId, auth.companyId));
    return JSON.parse(JSON.stringify(usersData));
}

export async function getTeamMembers(teamId: string) {
    const auth = await requireAuthOr401();
    if ('status' in auth) throw new Error("Unauthorized");

    const members = await db
        .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            avatarUrl: users.avatarUrl,
        })
        .from(usersToTeams)
        .innerJoin(users, eq(usersToTeams.userId, users.id))
        .where(and(eq(usersToTeams.teamId, teamId), eq(usersToTeams.companyId, auth.companyId)));

    return members;
}

export async function createTeam(name: string, description: string = "") {
    const auth = await requireAuthOr401();
    if ('status' in auth) throw new Error("Unauthorized");

    // Zod validation
    const parsed = TeamCreateSchema.parse({ name, description });

    const [newTeam] = await db.insert(teams).values({
        companyId: auth.companyId,
        name: parsed.name,
        description: parsed.description,
        active: true,
    }).returning();

    revalidatePath("/equipes");
    return newTeam;
}

export async function updateTeam(teamId: string, data: { name?: string; description?: string; active?: boolean }) {
    const auth = await requireAuthOr401();
    if ('status' in auth) throw new Error("Unauthorized");

    const parsed = TeamUpdateSchema.parse(data);

    const [updatedTeam] = await db
        .update(teams)
        .set(parsed)
        .where(and(eq(teams.id, teamId), eq(teams.companyId, auth.companyId)))
        .returning();

    revalidatePath("/equipes");
    return updatedTeam;
}

export async function deleteTeam(teamId: string) {
    const auth = await requireAuthOr401();
    if ('status' in auth) throw new Error("Unauthorized");

    await db.delete(teams).where(and(eq(teams.id, teamId), eq(teams.companyId, auth.companyId)));
    revalidatePath("/equipes");
    return { success: true };
}

export async function addMemberToTeam(teamId: string, userId: string) {
    const auth = await requireAuthOr401();
    if ('status' in auth) throw new Error("Unauthorized");

    const [link] = await db.insert(usersToTeams).values({
        teamId,
        userId,
        companyId: auth.companyId,
    }).returning();

    revalidatePath("/equipes");
    return link;
}

export async function removeMemberFromTeam(teamId: string, userId: string) {
    const auth = await requireAuthOr401();
    if ('status' in auth) throw new Error("Unauthorized");

    await db
        .delete(usersToTeams)
        .where(and(
            eq(usersToTeams.teamId, teamId),
            eq(usersToTeams.userId, userId),
            eq(usersToTeams.companyId, auth.companyId)
        ));

    revalidatePath("/equipes");
    return { success: true };
}
