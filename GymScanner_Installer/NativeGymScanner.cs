using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using MANTRA;

namespace GymScanner
{
    class Program
    {
        static MFS100 mfs100;
        static bool isContinuousMode = false;
        static string currentGymId = "";
        static List<StoredTemplate> dbTemplates = new List<StoredTemplate>();
        
        class StoredTemplate {
            public string Id;
            public string Base64Data;
            public byte[] Bytes;
        }

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
            CancellationTokenSource cts = new CancellationTokenSource();
            
            // Start the continuous scanning background loop if requested
            Task scanLoop = Task.Run(() => ContinuousScanLoop(webSocket, cts.Token));

            try
            {
                byte[] receiveBuffer = new byte[4096];
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
                            isContinuousMode = false; // Stop continuous if manual scan requested
                            Console.WriteLine("[*] Manual scan requested by dashboard (Registration)");
                            
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
                        else if (message.Contains("\"start_continuous\""))
                        {
                            // Extract gymId using simple regex
                            Match m = Regex.Match(message, "\"gymId\"\\s*:\\s*\"(.*?)\"");
                            if (m.Success)
                            {
                                currentGymId = m.Groups[1].Value;
                                Console.WriteLine("[*] Start Continuous Check-in Mode for Gym: " + currentGymId);
                                FetchTemplates(currentGymId);
                                isContinuousMode = true;
                            }
                        }
                        else if (message.Contains("\"stop_continuous\""))
                        {
                            Console.WriteLine("[*] Stopped Continuous Check-in Mode.");
                            isContinuousMode = false;
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
                cts.Cancel();
                isContinuousMode = false;
                if (webSocket != null)
                    webSocket.Dispose();
                Console.WriteLine("[*] Dashboard UI Disconnected.");
            }
        }
        
        static void FetchTemplates(string gymId)
        {
            try {
                Console.WriteLine("[*] Fetching registered member fingerprints from server...");
                using (WebClient client = new WebClient())
                {
                    string json = client.DownloadString("http://localhost:3000/api/biometrics/sync?gymId=" + gymId);
                    
                    dbTemplates.Clear();
                    // Basic regex parsing for {"id":"...", "name":"...", "template":"..."}
                    // Pattern allows for properties in any order roughly
                    MatchCollection matches = Regex.Matches(json, "\"id\":\"([^\"]+)\".*?\"template\":\"([^\"]+)\"");
                    foreach (Match m in matches)
                    {
                        try {
                            string id = m.Groups[1].Value;
                            string tpl = m.Groups[2].Value;
                            byte[] bytes = Convert.FromBase64String(tpl);
                            dbTemplates.Add(new StoredTemplate { Id = id, Base64Data = tpl, Bytes = bytes });
                        } catch { }
                    }
                    Console.WriteLine(string.Format("[*] Downloaded {0} member fingerprints.", dbTemplates.Count));
                }
            } 
            catch (Exception ex)
            {
                Console.WriteLine("[!] Failed to sync templates: " + ex.Message);
            }
        }
        
        static async Task ContinuousScanLoop(WebSocket webSocket, CancellationToken token)
        {
            while (!token.IsCancellationRequested)
            {
                if (isContinuousMode && webSocket.State == WebSocketState.Open)
                {
                    if (!mfs100.IsConnected())
                    {
                        mfs100.Init();
                    }

                    FingerData fingerData = new FingerData();
                    // Short timeout (1000ms) for continuous polling so it doesn't block forever
                    int ret = mfs100.AutoCapture(ref fingerData, 1000, false, false);
                    
                    if (ret == 0 && fingerData.ISOTemplate != null)
                    {
                        Console.WriteLine("\n[*] Finger placed! Matching...");
                        int bestScore = 0;
                        StoredTemplate bestMatch = null;
                        
                        foreach (var st in dbTemplates)
                        {
                            int score = 0;
                            int matchRet = mfs100.MatchISO(fingerData.ISOTemplate, st.Bytes, ref score);
                            if (matchRet == 0 && score > bestScore)
                            {
                                bestScore = score;
                                bestMatch = st;
                            }
                        }
                        
                        // Mantra Match Score > 140 is generally a solid match
                        if (bestScore >= 140 && bestMatch != null)
                        {
                            Console.WriteLine(string.Format("[+] MATCH FOUND! Score: {0}, ID: {1}", bestScore, bestMatch.Id));
                            string responseJson = string.Format("{{\"type\": \"scan\", \"fingerprintId\": \"{0}\"}}", bestMatch.Base64Data);
                            byte[] bytes = Encoding.UTF8.GetBytes(responseJson);
                            try {
                                await webSocket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
                            } catch { }
                            
                            // Sleep briefly to prevent multiple back-to-back punches for the same finger
                            await Task.Delay(3000, token);
                        }
                        else
                        {
                            Console.WriteLine(string.Format("[-] No match. Best score was: {0}", bestScore));
                            string responseJson = "{\"type\": \"scan\", \"fingerprintId\": \"UNKNOWN\"}";
                            byte[] bytes = Encoding.UTF8.GetBytes(responseJson);
                            try {
                                await webSocket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
                            } catch { }
                            await Task.Delay(1500, token);
                        }
                    }
                }
                
                await Task.Delay(500, token); // Small delay to prevent CPU hogging
            }
        }

        static async Task SendError(WebSocket webSocket, string error)
        {
            string responseJson = string.Format("{{\"type\": \"scan_result\", \"success\": false, \"error\": \"{0}\"}}", error);
            byte[] bytes = Encoding.UTF8.GetBytes(responseJson);
            try {
                await webSocket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
            } catch { }
        }
    }
}
