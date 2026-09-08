using System;
using System.IO;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using MANTRA;

namespace GymScanner
{
    class Program
    {
        static MFS100 mfs100;
        
        static void Main(string[] args)
        {
            MainAsync(args).GetAwaiter().GetResult();
        }

        static async Task MainAsync(string[] args)
        {
            Console.WriteLine("=========================================");
            Console.WriteLine(" GymFlow Native Fingerprint Bridge (MFS100) ");
            Console.WriteLine("=========================================");

            mfs100 = new MFS100();
            int ret = mfs100.Init();
            if (ret != 0)
            {
                Console.WriteLine("[!] Failed to initialize MFS100 device. Error Code: " + ret);
                Console.WriteLine("[!] Make sure the MFS100 scanner is plugged in!");
            }
            else
            {
                Console.WriteLine("[*] MFS100 Device Initialized Successfully!");
            }

            HttpListener listener = new HttpListener();
            listener.Prefixes.Add("http://localhost:8765/");
            listener.Start();
            Console.WriteLine("[*] Listening on ws://localhost:8765/");

            while (true)
            {
                HttpListenerContext context = await listener.GetContextAsync();
                if (context.Request.IsWebSocketRequest)
                {
                    ProcessRequest(context);
                }
                else
                {
                    context.Response.StatusCode = 400;
                    context.Response.Close();
                }
            }
        }

        static async void ProcessRequest(HttpListenerContext context)
        {
            WebSocketContext webSocketContext = null;
            try
            {
                webSocketContext = await context.AcceptWebSocketAsync(null);
                Console.WriteLine("[*] Dashboard UI Connected!");
            }
            catch (Exception e)
            {
                Console.WriteLine("Error: " + e.Message);
                return;
            }

            WebSocket webSocket = webSocketContext.WebSocket;
            try
            {
                byte[] receiveBuffer = new byte[1024];
                while (webSocket.State == WebSocketState.Open)
                {
                    WebSocketReceiveResult receiveResult = await webSocket.ReceiveAsync(new ArraySegment<byte>(receiveBuffer), CancellationToken.None);
                    
                    if (receiveResult.MessageType == WebSocketMessageType.Close)
                    {
                        await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "", CancellationToken.None);
                    }
                    else
                    {
                        string message = Encoding.UTF8.GetString(receiveBuffer, 0, receiveResult.Count);
                        Console.WriteLine("Received: " + message);
                        
                        if (message.Contains("\"action\":\"scan\"") || message.Contains("\"action\": \"scan\""))
                        {
                            Console.WriteLine("[*] Manual scan requested by dashboard (Registration)");
                            
                            // Check if device is connected
                            if (!mfs100.IsConnected())
                            {
                                int initRet = mfs100.Init();
                                if (initRet != 0)
                                {
                                    await SendError(webSocket, "Scanner not connected.");
                                    continue;
                                }
                            }

                            FingerData fingerData = new FingerData();
                            Console.WriteLine("[*] Please place finger on scanner...");
                            
                            // Timeout: 10000ms, ShowPreview: false, IsDetectFinger: true
                            int ret = mfs100.AutoCapture(ref fingerData, 10000, false, true);
                            
                            if (ret == 0)
                            {
                                Console.WriteLine("[*] Scan successful!");
                                string base64Template = Convert.ToBase64String(fingerData.ISOTemplate);
                                string responseJson = string.Format("{{\"type\": \"scan_result\", \"success\": true, \"template\": \"{0}\"}}", base64Template);
                                byte[] bytes = Encoding.UTF8.GetBytes(responseJson);
                                await webSocket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
                            }
                            else
                            {
                                Console.WriteLine(string.Format("[!] Scan failed. Error Code: {0}", ret));
                                await SendError(webSocket, "Scan failed. Please try again.");
                            }
                        }
                    }
                }
            }
            catch (Exception e)
            {
                Console.WriteLine("Exception: " + e.Message);
            }
            finally
            {
                if (webSocket != null)
                    webSocket.Dispose();
                Console.WriteLine("[*] Dashboard UI Disconnected.");
            }
        }
        
        static async Task SendError(WebSocket webSocket, string error)
        {
            string responseJson = string.Format("{{\"type\": \"scan_result\", \"success\": false, \"error\": \"{0}\"}}", error);
            byte[] bytes = Encoding.UTF8.GetBytes(responseJson);
            await webSocket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
        }
    }
}
