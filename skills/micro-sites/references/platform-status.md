# Platform status and incident-aware diagnosis

Call `micro_platform_status` (or `micro platform status --json`) before changing
working code when several live routes fail, authentication or deployment is
unavailable, or a provider-backed capability suddenly regresses. It requires
neither owner authentication nor a linked project.

The response is `micro.status.v1` with an overall `operational`, `degraded`, or
`major_outage` state, eight fixed components, published incident updates, and a
bounded 30-day SLO indicator window. Treat published incidents as the customer
communication authority. The successful-response ratio includes
application-generated HTTP 5xx responses, so do not infer platform causality
from that ratio alone.

If the relevant component is degraded or in outage, preserve local source and
production state. Report the incident, wait or monitor as requested, and do not
redeploy, rotate credentials, disconnect providers, or roll back a healthy
revision merely to probe the platform. If platform status is operational,
continue with linked `micro_status`, bounded logs, deployment history, resource
state, and a real browser reproduction.

The skill and MCP expose only public status. They never accept the internal
operations bearer token and cannot create or publish incidents.
