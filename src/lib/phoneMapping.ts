import { supabase } from "./supabaseClient";

/**
 * Generic retry function for Supabase queries
 */
async function retrySupabaseQuery(
    queryFn: () => Promise<{ data: any; error: any }>,
    maxRetries: number = 3
): Promise<{ data: any; error: any }> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const result = await queryFn();

        if (!result.error) {
            return result;
        }

        if (attempt < maxRetries) {
            console.log(`Supabase query attempt ${attempt} failed, retrying in ${attempt * 1000}ms...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
    }

    // Return the last result (which will have the error)
    return await queryFn();
}

/**
 * Get all file IDs mapped to a phone number
 */
export async function getFilesForPhoneNumber(phoneNumber: string): Promise<string[]> {
    const { data, error } = await supabase
        .from("phone_document_mapping")
        .select("file_id")
        .eq("phone_number", phoneNumber)
        .not("file_id", "is", null);

    if (error) {
        console.error("Error fetching files for phone number:", error);
        return [];
    }

    return data?.map(row => row.file_id).filter(Boolean) || [];
}

/**
 * Get Shopify store ID mapped to a phone number
 */
export async function getShopifyStoreForPhoneNumber(phoneNumber: string): Promise<string | null> {
    const { data, error } = await retrySupabaseQuery(async () =>
        await supabase
            .from("phone_document_mapping")
            .select("shopify_store_id")
            .eq("phone_number", phoneNumber)
            .not("shopify_store_id", "is", null)
            .single()
    );

    if (error) {
        if (error.code === 'PGRST116') { // No rows returned
            return null;
        }
        console.error("Error fetching Shopify store for phone number:", error);
        return null;
    }

    return data?.shopify_store_id || null;
}

/**
 * Check if a phone number has any document mappings (files or Shopify)
 */
export async function hasDocumentMapping(phoneNumber: string): Promise<boolean> {
    const { count, error } = await supabase
        .from("phone_document_mapping")
        .select("*", { count: "exact", head: true })
        .eq("phone_number", phoneNumber);

    if (error) {
        console.error("Error checking document mapping:", error);
        return false;
    }

    return (count || 0) > 0;
}

/**
 * Check if a phone number has Shopify store mapping
 */
export async function hasShopifyMapping(phoneNumber: string): Promise<boolean> {
    const storeId = await getShopifyStoreForPhoneNumber(phoneNumber);
    return storeId !== null;
}

/**
 * Create or update phone mapping for Shopify store
 */
export async function createShopifyMapping(
    phoneNumber: string,
    shopifyStoreId: string,
    intent?: string,
    systemPrompt?: string,
    authToken?: string,
    origin?: string
): Promise<void> {
    const { error } = await supabase
        .from("phone_document_mapping")
        .upsert({
            phone_number: phoneNumber,
            shopify_store_id: shopifyStoreId,
            data_source: 'shopify',
            intent,
            system_prompt: systemPrompt,
            auth_token: authToken,
            origin
        }, {
            onConflict: 'phone_number'
        });

    if (error) {
        throw new Error(`Failed to create Shopify mapping: ${error.message}`);
    }
}

/**
 * Get voice FAQ IDs mapped to a phone number
 */
export async function getVoiceFAQsForPhoneNumber(phoneNumber: string): Promise<string[]> {
    // For now, we'll check if there are any voice FAQs in the system
    // In the future, this could be extended to have specific mappings
    const { data, error } = await supabase
        .from("voice_faqs")
        .select("id")
        .limit(100); // Get all voice FAQs for now

    if (error) {
        console.error("Error fetching voice FAQs:", error);
        return [];
    }

    return data?.map(row => row.id) || [];
}

/**
 * Get all data sources for a phone number (unified approach)
 */
export async function getAllDataSourcesForPhone(phoneNumber: string): Promise<{
    files: string[]
    shopifyStoreId: string | null
    voiceFaqIds: string[]
}> {
    const [files, shopifyStoreId, voiceFaqIds] = await Promise.all([
        getFilesForPhoneNumber(phoneNumber),
        getShopifyStoreForPhoneNumber(phoneNumber),
        getVoiceFAQsForPhoneNumber(phoneNumber)
    ]);

    return {
        files,
        shopifyStoreId,
        voiceFaqIds
    };
}
