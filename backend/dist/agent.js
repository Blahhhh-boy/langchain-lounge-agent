"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const google_genai_1 = require("@langchain/google-genai");
const langgraph_1 = require("@langchain/langgraph");
const messages_1 = require("@langchain/core/messages");
const prebuilt_1 = require("@langchain/langgraph/prebuilt");
const mcp_adapters_1 = require("@langchain/mcp-adapters");
console.log(process.env.TEST);
function setupAgent() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Wait a bit to ensure the MCP server is ready
            console.log('GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY ? 'Found' : 'Not found');
            yield new Promise(resolve => setTimeout(resolve, 2000));
            // Define the tools for the agent to use
            const mcpClient = new mcp_adapters_1.MultiServerMCPClient({
                throwOnLoadError: true,
                prefixToolNameWithServerName: false,
                mcpServers: {
                    loungeServer: {
                        url: "http://localhost:3000",
                        automaticSSEFallback: false
                    }
                },
            });
            console.log("Connecting to MCP server...");
            const tools = yield mcpClient.getTools();
            console.log("Available tools:", tools.map(t => t.name));
            const toolNode = new prebuilt_1.ToolNode(tools);
            const model = new google_genai_1.ChatGoogleGenerativeAI({
                model: "gemini-2.0-flash",
                apiKey: process.env.GOOGLE_API_KEY
            }).bindTools(tools);
            function shouldContinue({ messages }) {
                var _a;
                const lastMessage = messages[messages.length - 1];
                if ((_a = lastMessage.tool_calls) === null || _a === void 0 ? void 0 : _a.length) {
                    return "tools";
                }
                return "__end__";
            }
            // Define the function that calls the model
            function callModel(state) {
                return __awaiter(this, void 0, void 0, function* () {
                    const response = yield model.invoke(state.messages);
                    // We return a list, because this will get added to the existing list
                    return { messages: [response] };
                });
            }
            const workflow = new langgraph_1.StateGraph(langgraph_1.MessagesAnnotation)
                .addNode("agent", callModel)
                .addEdge("__start__", "agent") // __start__ is a special name for the entrypoint
                .addNode("tools", toolNode)
                .addEdge("tools", "agent")
                .addConditionalEdges("agent", shouldContinue);
            const app = workflow.compile();
            // Use the agent with actual flight/lounge queries
            console.log("Getting available lounges...");
            const loungeState = yield app.invoke({
                messages: [new messages_1.HumanMessage("Get me the available lounges for session 00009223581026309436128527")],
            });
            console.log("Lounge Response:", loungeState.messages[loungeState.messages.length - 1].content);
            console.log("\nGetting flight information...");
            const flightState = yield app.invoke({
                messages: [
                    ...loungeState.messages,
                    new messages_1.HumanMessage("Get flight data for session 00009223581026309436128527, departure from NMIA on 20241225 for flight AC920")
                ],
            });
            console.log("Flight Response:", flightState.messages[flightState.messages.length - 1].content);
            // Alternative: You can also test with direct parameters
            console.log("\nTesting another flight query...");
            const anotherFlightState = yield app.invoke({
                messages: [
                    new messages_1.HumanMessage(`Please help me get flight information with these details:
        - Session ID: "00009223581026309436128527"
        - Direction: A (arrival)
        - Travel Date: 20250701
        - Airport: SIA
        - Flight: AC1804`)
                ],
            });
            console.log("Another Flight Response:", anotherFlightState.messages[anotherFlightState.messages.length - 1].content);
        }
        catch (error) {
            console.error("Error setting up agent:", error);
            if (error instanceof Error) {
                console.error("Error details:", error.message);
                console.error("Stack:", error.stack);
            }
        }
    });
}
// Run the agent setup
setupAgent();
