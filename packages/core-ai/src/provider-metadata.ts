/**
 * Returns the provider-namespaced metadata sub-object, typed as `T`, or
 * `undefined` if absent. Serves as both the ownership check and the typed
 * accessor — checking `meta == null` is sufficient to detect a cross-provider
 * block.
 *
 * Each provider defines its own metadata type `T` and passes it at the call
 * site. The cast is safe because only the provider that wrote the metadata
 * ever reads it.
 *
 * @example
 * ```ts
 * type AnthropicReasoningMetadata = { signature?: string; redactedData?: string };
 *
 * const meta = getProviderMetadata<AnthropicReasoningMetadata>(providerMetadata, 'anthropic');
 * if (meta == null) {
 *     // cross-provider — downgrade to text
 * } else {
 *     const { signature, redactedData } = meta; // fully typed
 * }
 * ```
 */
export function getProviderMetadata<T extends Record<string, unknown>>(
    providerMetadata: Record<string, Record<string, unknown>> | undefined,
    provider: string
): T | undefined {
    return providerMetadata?.[provider] as T | undefined;
}
