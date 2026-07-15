# Terms of Service

**Malon MCP Server**

_Version 0.0.1 — In Development_

> **These terms are a skeleton placeholder and have not been reviewed by legal counsel.**
> They must be reviewed and finalized by a qualified lawyer before the first real user.
> See AGENTS.md §24 Phase 2 checklist item 6.

## 1. Acceptance

By using Malon ("the Software"), you agree to these terms. If you do not agree, do not use the Software.

## 2. License

The Software is provided under the MIT License (see `LICENSE`). You may use, copy, modify, merge, publish, distribute, sublicense, and sell copies of the Software subject to the terms of that license.

## 3. No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.

## 4. Limitation of Liability

IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## 5. Data Handling

The Software runs locally on your machine. By default, no data leaves your machine except:

- Short code spans sent to the configured LLM provider when you explicitly call `malon_search`.
- Telemetry data if you explicitly opt in (`MALON_TELEMETRY=1` or `config.yml: telemetry.enabled: true`).

See `SECURITY.md` for a detailed description of data flows.

## 6. Changes

These terms may be updated. Continued use after changes constitutes acceptance of the new terms.

---

_Contact: security@yourdomain_
