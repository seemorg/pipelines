import { client } from "@/lib/typesense";

/**
 * Cleans up old collections for a given collection base name.
 * Keeps only the latest `keepVersions` collections (default: 2).
 * Never deletes collections that are currently aliased.
 * 
 * @param collectionBaseName - The base name of the collection (e.g., "authors", "books")
 * @param keepVersions - Number of recent collections to keep (default: 2)
 * @param excludeCollection - Optional collection name to exclude from deletion (e.g., the current one being indexed)
 */
export async function cleanupOldCollections(
    collectionBaseName: string,
    keepVersions: number = 2,
    excludeCollection?: string,
): Promise<void> {
    try {
        // Get all collections
        const allCollections = await client.collections().retrieve();

        // Get the aliased collection for this base name (if it exists)
        let aliasedCollectionName: string | null = null;
        try {
            const alias = await client.aliases(collectionBaseName).retrieve();
            aliasedCollectionName = alias.collection_name;
        } catch (e) {
            // Alias doesn't exist, that's fine
        }

        // Filter collections that match the base name pattern (e.g., "authors_1234567890")
        const matchingCollections = allCollections
            .filter((col) => col.name.startsWith(`${collectionBaseName}_`))
            .map((col) => ({
                name: col.name,
                // Extract timestamp from collection name (format: baseName_timestamp)
                timestamp: parseInt(col.name.split("_").pop() || "0", 10),
            }))
            .filter((col) => !isNaN(col.timestamp)) // Only keep valid timestamped collections
            .sort((a, b) => b.timestamp - a.timestamp); // Sort by timestamp descending (newest first)

        // Filter out collections that are aliased or should be excluded
        const collectionsToKeep = matchingCollections.filter(
            (col) =>
                col.name !== aliasedCollectionName &&
                col.name !== excludeCollection,
        );

        // Keep only the latest `keepVersions` collections, delete the rest
        const collectionsToDelete = collectionsToKeep.slice(keepVersions);

        if (collectionsToDelete.length === 0) {
            console.log(
                `No old collections to clean up for ${collectionBaseName}`,
            );
            return;
        }

        console.log(
            `Cleaning up ${collectionsToDelete.length} old collection(s) for ${collectionBaseName}...`,
        );

        // Delete old collections
        for (const collection of collectionsToDelete) {
            try {
                await client.collections(collection.name).delete();
                console.log(`Deleted old collection: ${collection.name}`);
            } catch (error) {
                console.error(
                    `Failed to delete collection ${collection.name}:`,
                    error,
                );
                // Continue with other deletions even if one fails
            }
        }

        console.log(
            `Cleanup complete. Kept ${Math.min(keepVersions, matchingCollections.length)} latest collection(s) for ${collectionBaseName}`,
        );
    } catch (error) {
        console.error(
            `Error during cleanup for ${collectionBaseName}:`,
            error,
        );
        // Don't throw - cleanup failures shouldn't break indexing
    }
}

/**
 * Swaps the alias to point to a new collection and optionally deletes the old collection.
 * 
 * @param aliasName - The alias name (e.g., "authors")
 * @param newCollectionName - The new collection name to point the alias to
 * @param deleteOldCollection - Whether to delete the old collection that the alias was pointing to (default: true)
 */
export async function swapAlias(
    aliasName: string,
    newCollectionName: string,
    deleteOldCollection: boolean = true,
): Promise<void> {
    let oldCollectionName: string | null = null;

    // Get the old collection name from the alias if it exists
    try {
        const alias = await client.aliases(aliasName).retrieve();
        oldCollectionName = alias.collection_name;
    } catch (e) {
        // Alias doesn't exist yet, that's fine
        console.log(`Alias ${aliasName} does not exist yet, will create it`);
    }

    // Update the alias to point to the new collection
    console.log(`Linking alias ${aliasName} to new collection ${newCollectionName}...`);
    await client.aliases().upsert(aliasName, {
        collection_name: newCollectionName,
    });

    // Delete the old collection if requested and it exists
    if (deleteOldCollection && oldCollectionName && oldCollectionName !== newCollectionName) {
        try {
            console.log(`Deleting old collection: ${oldCollectionName}`);
            await client.collections(oldCollectionName).delete();
        } catch (error) {
            console.error(
                `Failed to delete old collection ${oldCollectionName}:`,
                error,
            );
            // Don't throw - old collection deletion failure shouldn't break indexing
        }
    }
}

