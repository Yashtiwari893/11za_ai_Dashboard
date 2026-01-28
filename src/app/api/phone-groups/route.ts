import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(req: Request) {
    try {
        // Verify authentication using cookies
        const cookieStore = await cookies();
        const supabaseServer = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll(cookiesToSet: any) {
                        cookiesToSet.forEach(({ name, value, options }: any) => {
                            cookieStore.set(name, value, options);
                        });
                    },
                },
            }
        );

        const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get all phone mappings with file details
        const { data: mappings, error: mappingError } = await supabase
            .from("phone_document_mapping")
            .select(`
                phone_number,
                intent,
                system_prompt,
                auth_token,
                origin,
                file_id,
                rag_files (
                    id,
                    name,
                    file_type,
                    created_at
                )
            `)
            .order("phone_number", { ascending: true });

        if (mappingError) {
            throw mappingError;
        }

        // Get chunk counts for each file
        const { data: chunkCounts, error: chunkError } = await supabase
            .from("rag_chunks")
            .select("file_id");

        if (chunkError) {
            throw chunkError;
        }

        // Count chunks per file
        const chunkCountMap: Record<string, number> = {};
        chunkCounts?.forEach((chunk: any) => {
            chunkCountMap[chunk.file_id] = (chunkCountMap[chunk.file_id] || 0) + 1;
        });

        // Group by phone number
        const phoneGroups: Record<string, any> = {};

        mappings?.forEach((mapping: any) => {
            const phone = mapping.phone_number;
            const file = mapping.rag_files;

            if (!phoneGroups[phone]) {
                phoneGroups[phone] = {
                    phone_number: phone,
                    intent: mapping.intent,
                    system_prompt: mapping.system_prompt,
                    auth_token: mapping.auth_token || "",
                    origin: mapping.origin || "",
                    files: [],
                };
            }

            if (file) {
                phoneGroups[phone].files.push({
                    id: file.id,
                    name: file.name,
                    file_type: file.file_type,
                    chunk_count: chunkCountMap[file.id] || 0,
                    created_at: file.created_at,
                });
            }
        });

        const groups = Object.values(phoneGroups);

        return NextResponse.json({
            success: true,
            groups,
        });
    } catch (error) {
        console.error("Error fetching phone groups:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to fetch phone groups",
            },
            { status: 500 }
        );
    }
}

export async function DELETE(req: Request) {
    try {
        // Verify authentication using cookies
        const cookieStore = await (await import("next/headers")).cookies();
        const { createServerClient } = await import("@supabase/ssr");
        const supabaseServer = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll(cookiesToSet: any) {
                        cookiesToSet.forEach(({ name, value, options }: any) => {
                            cookieStore.set(name, value, options);
                        });
                    },
                },
            }
        );

        const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { phoneNumber } = await req.json();

        if (!phoneNumber) {
            return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
        }

        // Delete all phone mappings for this phone number
        const { error: deleteMappingError } = await supabase
            .from("phone_document_mapping")
            .delete()
            .eq("phone_number", phoneNumber);

        if (deleteMappingError) {
            throw deleteMappingError;
        }

        // Delete all call recordings for this phone number
        const { error: deleteCallsError } = await supabase
            .from("call_recordings")
            .delete()
            .eq("phone_number", phoneNumber);

        if (deleteCallsError) {
            throw deleteCallsError;
        }

        return NextResponse.json({
            success: true,
            message: `Phone number ${phoneNumber} and all associated data deleted successfully`,
        });
    } catch (error) {
        console.error("Error deleting phone group:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Failed to delete phone group",
            },
            { status: 500 }
        );
    }
}
