import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(req: Request) {
    try {
        // Verify authentication
        const authHeader = req.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.slice(7);
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const phoneNumber = searchParams.get("phone_number");
        const status = searchParams.get("status");

        let query = supabase
            .from("v_call_recordings_with_metadata")
            .select("*")
            .order("uploaded_at", { ascending: false });

        if (phoneNumber) {
            query = query.eq("phone_number", phoneNumber);
        }

        if (status) {
            query = query.eq("status", status);
        }

        const { data, error } = await query;

        if (error) {
            console.error("Error fetching calls:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ calls: data || [] });
    } catch (error) {
        console.error("Error in calls GET:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "id is required" }, { status: 400 });
        }

        // Delete call recording (cascades to transcripts, classifications, and rag_chunks)
        const { error } = await supabase
            .from("call_recordings")
            .delete()
            .eq("id", id);

        if (error) {
            console.error("Error deleting call:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error in calls DELETE:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
