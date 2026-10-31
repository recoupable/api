# Disable automatic retries for pack still inspection

Follow-up to app#2266's existing no-automatic-paid-retry requirement. The installed
AI SDK documents two retries by default. Captions already set maxRetries:0, while
still inspection omitted it. Add maxRetries:0 to the shared stillInspection settings,
which are passed to generateText and included in quote configuration identity.

Existing quotes without this setting become unsupported for unstarted work and need
a fresh estimate/approval under the merged configuration contract. Accepted fal
receipts are unchanged. No model, rate, provider or production data changes.

Mocked regression tests verify the SDK option, successful image inspection, failure
propagation without another file/call, and old-versus-current quote compatibility.
They do not prove provider billing or live SDK network retry behavior. Three tests
failed on the original setting before the one-line fix.
