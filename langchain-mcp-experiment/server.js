import express from "express";
import { getLounge, getSchedule } from "./tools.js";

const app = express();
const port = 3000;

app.use(express.json());

// MCP Protocol endpoints
app.post("/", async (req, res) => {
  const { method, params, id } = req.body;
  
  console.log(`MCP Request: ${method}`, params);
  
  switch (method) {
    case "initialize":
      res.json({
        jsonrpc: "2.0",
        id: id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: "mcp_server",
            version: "1.0.0",
          },
        },
      });
      break;
                      
    case "notifications/initialized":
      res.status(200).end();
      break;
      
    case "tools/list":
      res.json({
        jsonrpc: "2.0",
        id: id,
        result: {
          tools: [
            { 
              name: "get_lounge",
              description: "Provides you the lounge names to be selected",
              inputSchema: {
                type: "object",
                properties: {
                  sessionId: {
                    type: "string",
                    description: "Id of the scheduled session"
                  }
                },
                required: ["sessionId"]
              }
            },
            {
              name: "get_flight_data",
              description: "Provides Flight information from flight id",
              inputSchema: {
                type: "object",
                properties: {
                  sessionId: {
                    type: "string",
                    description: "Id of the scheduled session"
                  },
                  direction: {
                    type: "string",
                    enum: ["A", "D"],
                    description: "whether the lounge is getting booked for arrival(A) for departure(D)"
                  },
                  travelDate: {
                    type: "string",
                    pattern: "^\\d{8}$",
                    description: "Date for the lounge to get booked provided by the user (YYYYMMDD format)"
                  },
                  airportId: {
                    type: "string",
                    enum: ["NMIA", "SIA"],
                    description: "The Airport where the lounge is getting booked"
                  },
                  flightId: {
                    type: "string",
                    description: "Flight Id(Flight Code and Flight Number) provided by the user"
                  }
                },
                required: ["sessionId", "direction", "travelDate", "airportId", "flightId"]
              }
            }
          ]
        }
      });
      break;
      
    case "tools/call":
      const { name, arguments: args } = params;
      
      try {
        switch (name) {
          case "get_lounge":
            const lounges = await getLounge({ sessionId: args.sessionId });
            res.json({
              jsonrpc: "2.0",
              id: id,
              result: {
                content: [
                  {
                    type: "text",
                    text: `Please Choose the lounge from ${lounges}`
                  }
                ]
              }
            });
            break;

          case "get_flight_data":
            const flightData = await getSchedule({ 
              sessionId: args.sessionId, 
              direction: args.direction, 
              travelDate: args.travelDate, 
              airportId: args.airportId, 
              flightId: args.flightId 
            });
            res.json({
              jsonrpc: "2.0",
              id: id,
              result: {
                content: [
                  {
                    type: "text",
                    text: `Your Flight is ${flightData}`
                  }
                ]
              }
            });
            break;

          default:
            res.status(400).json({
              jsonrpc: "2.0",
              id: id,
              error: {
                code: -32601,
                message: `Unknown tool: ${name}`
              }
            });
        }
      } catch (error) {
        console.error(`Error in tool ${name}:`, error);
        res.status(500).json({
          jsonrpc: "2.0",
          id: id,
          error: {
            code: -32603,
            message: `Internal error in ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        });
      }
      break;
      
    default:
      // For notifications (methods without id), just return 200
      if (!id) {
        console.log(`Received notification: ${method}`);
        res.status(200).end();
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          id: id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          }
        });
      }
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`🚀 MCP server running at http://localhost:${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
});