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
        static bool isDeviceConnected = false;
        static bool isContinuousMode = false;
        static bool isPausedForManualScan = false;
        static int activeContinuousSubscribers = 0;
        static string currentGymId = "";
        static DateTime lastTemplateSync = DateTime.MinValue;
        static List<StoredTemplate> dbTemplates = new List<StoredTemplate>();
        static readonly object scannerLock = new object();
        
        class StoredTemplate {
            public string Id;
            public string Name;
            public string Role;
            public string Base64Data;
            public byte[] Bytes;
        }

        static void Main(string[] args)
        {
            MainAsync(args).GetAwaiter().GetResult();
        }

        static async Task MainAsync(string[] args)
        {
            Console.WriteLine("=================================================");
            Console.WriteLine("  GymFlow Native Fingerprint Bridge (MFS100)     ");
            Console.WriteLine("  Auto-Reconnect & Multi-Mode Biometric Service  ");
            Console.WriteLine("=================================================");

            InitializeDevice();

            HttpListener listener = new HttpListener();
            try
            {
                listener.Prefixes.Add("http://localhost:8765/");
                listener.Start();
                Console.WriteLine("[*] WebSocket bridge listening on ws://localhost:8765/");
            }
            catch (Exception ex)
            {
                Console.WriteLine("[!] Failed to bind port 8765: " + ex.Message);
                return;
            }

            while (true)
            {
                try
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
                catch (Exception ex)
                {
                    Console.WriteLine("[!] Listener error: " + ex.Message);
                    Thread.Sleep(500);
                }
            }
        }

        static void InitializeDevice()
        {
            lock (scannerLock)
            {
                try
                {
                    if (mfs100 != null)
                    {
                        try { mfs100.Uninit(); } catch {}
                        try { mfs100.Dispose(); } catch {}
                    }
                    mfs100 = new MFS100();
                    if (mfs100.IsConnected())
                    {
                        int ret = mfs100.Init();
                        if (ret == 0)
                        {
                            isDeviceConnected = true;
                            Console.WriteLine("[*] MFS100 Device Initialized Successfully!");
                            return;
                        }
                        else
                        {
                            Console.WriteLine(string.Format("[!] MFS100 Init returned code {0}. Waiting for valid hardware state...", ret));
                        }
                    }
                    else
                    {
                        Console.WriteLine("[!] MFS100 scanner is not plugged in. Waiting for USB connection...");
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine("[!] Device init exception: " + ex.Message);
                }
                isDeviceConnected = false;
            }
        }

        static async void ProcessRequest(HttpListenerContext context)
        {
            WebSocketContext webSocketContext = null;
            try
            {
                webSocketContext = await context.AcceptWebSocketAsync(null);
                Console.WriteLine("[*] Dashboard UI Client Connected!");
            }
            catch (Exception e)
            {
                Console.WriteLine("Error accepting WS: " + e.Message);
                return;
            }

            WebSocket webSocket = webSocketContext.WebSocket;
            CancellationTokenSource cts = new CancellationTokenSource();
            bool isThisConnContinuous = false;
            
            // Start the continuous scanning background loop for this connection
            Task scanLoop = Task.Run(() => ContinuousScanLoop(webSocket, cts.Token));

            try
            {
                byte[] receiveBuffer = new byte[8192];
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
                            // Temporary pause continuous loop while single registration capture is running
                            isPausedForManualScan = true;
                            Console.WriteLine("[*] Manual scan requested by dashboard (Registration)");
                            
                            string manualError = null;
                            string successTemplate = null;

                            try
                            {
                                int ret = -1;
                                FingerData fingerData = new FingerData();
                                bool ready = false;

                                lock (scannerLock)
                                {
                                    if (mfs100 == null) mfs100 = new MFS100();
                                    if (!mfs100.IsConnected())
                                    {
                                        InitializeDevice();
                                    }
                                    ready = (mfs100 != null && mfs100.IsConnected());
                                    if (ready)
                                    {
                                        Console.WriteLine("[*] Please place finger on scanner for registration...");
                                        ret = mfs100.AutoCapture(ref fingerData, 10000, false, true);
                                    }
                                }
                                
                                if (!ready)
                                {
                                    manualError = "Scanner not plugged in. Please connect USB cable.";
                                }
                                else if (ret == 0 && fingerData.ISOTemplate != null)
                                {
                                    Console.WriteLine("[*] Registration Scan Successful!");
                                    successTemplate = Convert.ToBase64String(fingerData.ISOTemplate);
                                }
                                else
                                {
                                    Console.WriteLine(string.Format("[!] Scan failed. Error Code: {0}", ret));
                                    manualError = "Scan failed. Please place your finger firmly and try again.";
                                }
                            }
                            catch (Exception ex)
                            {
                                Console.WriteLine("[!] Exception in manual scan: " + ex.Message);
                                manualError = "Scanner error: " + ex.Message;
                            }
                            finally
                            {
                                isPausedForManualScan = false;
                            }

                            if (!string.IsNullOrEmpty(successTemplate))
                            {
                                string responseJson = string.Format("{{\"type\": \"scan_result\", \"success\": true, \"template\": \"{0}\"}}", successTemplate);
                                byte[] bytes = Encoding.UTF8.GetBytes(responseJson);
                                await webSocket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
                            }
                            else if (!string.IsNullOrEmpty(manualError))
                            {
                                await SendError(webSocket, manualError);
                            }
                        }
                        else if (message.Contains("\"start_continuous\""))
                        {
                            Match m = Regex.Match(message, "\"gymId\"\\s*:\\s*\"(.*?)\"");
                            if (m.Success)
                            {
                                currentGymId = m.Groups[1].Value;
                                Console.WriteLine("[*] Start Continuous Check-in Mode for Gym: " + currentGymId);
                                FetchTemplates(currentGymId);
                            }
                            if (!isThisConnContinuous)
                            {
                                isThisConnContinuous = true;
                                Interlocked.Increment(ref activeContinuousSubscribers);
                            }
                            isContinuousMode = true;
                        }
                        else if (message.Contains("\"stop_continuous\""))
                        {
                            Console.WriteLine("[*] Stopped Continuous Check-in Mode for this connection.");
                            if (isThisConnContinuous)
                            {
                                isThisConnContinuous = false;
                                int remaining = Interlocked.Decrement(ref activeContinuousSubscribers);
                                if (remaining <= 0)
                                {
                                    isContinuousMode = false;
                                }
                            }
                        }
                        else if (message.Contains("\"action\":\"sync\"") || message.Contains("\"action\":\"refresh\"") || message.Contains("\"refresh_templates\""))
                        {
                            Console.WriteLine("[*] Immediate template refresh requested by dashboard.");
                            Match m = Regex.Match(message, "\"gymId\"\\s*:\\s*\"(.*?)\"");
                            string syncGym = m.Success ? m.Groups[1].Value : currentGymId;
                            if (!string.IsNullOrEmpty(syncGym))
                            {
                                FetchTemplates(syncGym);
                            }
                        }
                    }
                }
            }
            catch (Exception e)
            {
                Console.WriteLine("Connection Exception: " + e.Message);
            }
            finally
            {
                cts.Cancel();
                if (isThisConnContinuous)
                {
                    int remaining = Interlocked.Decrement(ref activeContinuousSubscribers);
                    if (remaining <= 0)
                    {
                        isContinuousMode = false;
                    }
                }
                if (webSocket != null)
                {
                    try { webSocket.Dispose(); } catch {}
                }
                Console.WriteLine("[*] Dashboard UI Client Disconnected.");
            }
        }
        
        static void FetchTemplates(string gymId)
        {
            if (string.IsNullOrEmpty(gymId)) return;
            try
            {
                Console.WriteLine("[*] Fetching registered member fingerprints from server for gym: " + gymId);
                using (WebClient client = new WebClient())
                {
                    client.Encoding = Encoding.UTF8;
                    string json = client.DownloadString("http://localhost:3000/api/biometrics/sync?gymId=" + gymId);
                    
                    var newTemplates = new List<StoredTemplate>();
                    
                    // Match each object in the templates array: {"id":"...", "name":"...", "role":"...", "template":"..."}
                    MatchCollection objMatches = Regex.Matches(json, @"\{[^{}]*""id""\s*:\s*""([^""]+)""[^{}]*\}");
                    foreach (Match objMatch in objMatches)
                    {
                        string block = objMatch.Value;
                        Match idM = Regex.Match(block, @"""id""\s*:\s*""([^""]+)""");
                        Match nameM = Regex.Match(block, @"""name""\s*:\s*""([^""]+)""");
                        Match roleM = Regex.Match(block, @"""role""\s*:\s*""([^""]+)""");
                        Match tplM = Regex.Match(block, @"""template""\s*:\s*""([^""]+)""");

                        if (idM.Success && tplM.Success)
                        {
                            try
                            {
                                string id = idM.Groups[1].Value;
                                string name = nameM.Success ? nameM.Groups[1].Value : "Member";
                                string role = roleM.Success ? roleM.Groups[1].Value : "Member";
                                string tpl = tplM.Groups[1].Value;
                                
                                byte[] bytes = Convert.FromBase64String(tpl);
                                if (bytes.Length > 0)
                                {
                                    newTemplates.Add(new StoredTemplate
                                    {
                                        Id = id,
                                        Name = name,
                                        Role = role,
                                        Base64Data = tpl,
                                        Bytes = bytes
                                    });
                                }
                            }
                            catch {}
                        }
                    }
                    
                    dbTemplates = newTemplates;
                    lastTemplateSync = DateTime.UtcNow;
                    Console.WriteLine(string.Format("[*] Downloaded {0} member & staff fingerprints successfully.", dbTemplates.Count));
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
                try
                {
                    if (isContinuousMode && !isPausedForManualScan && webSocket.State == WebSocketState.Open)
                    {
                        // Periodic background template sync every 45 seconds to catch newly enrolled members
                        if ((DateTime.UtcNow - lastTemplateSync).TotalSeconds > 45 && !string.IsNullOrEmpty(currentGymId))
                        {
                            lastTemplateSync = DateTime.UtcNow;
                            ThreadPool.QueueUserWorkItem(state => FetchTemplates(currentGymId));
                        }

                        // Check USB connection before attempting capture
                        bool deviceReady = false;
                        lock (scannerLock)
                        {
                            try
                            {
                                if (mfs100 == null) mfs100 = new MFS100();
                                if (mfs100.IsConnected())
                                {
                                    if (!isDeviceConnected)
                                    {
                                        int initRet = mfs100.Init();
                                        if (initRet == 0)
                                        {
                                            isDeviceConnected = true;
                                            Console.WriteLine("[*] MFS100 Scanner Reconnected & Ready!");
                                        }
                                    }
                                    deviceReady = isDeviceConnected;
                                }
                                else
                                {
                                    isDeviceConnected = false;
                                }
                            }
                            catch (Exception ex)
                            {
                                Console.WriteLine("[!] USB state check error: " + ex.Message);
                                isDeviceConnected = false;
                            }
                        }

                        if (!deviceReady)
                        {
                            // Scanner is unplugged. Wait gently and loop without crashing.
                            await Task.Delay(1500, token);
                            continue;
                        }

                        // Scanner is verified connected - perform AutoCapture
                        FingerData fingerData = new FingerData();
                        int ret = -1;

                        try
                        {
                            lock (scannerLock)
                            {
                                if (mfs100 != null && isDeviceConnected)
                                {
                                    // 2500ms timeout keeps the loop responsive while waiting for finger touches
                                    ret = mfs100.AutoCapture(ref fingerData, 2500, false, false);
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine("[!] AutoCapture exception (likely unplugged): " + ex.Message);
                            ret = -999;
                        }

                        if (ret != 0)
                        {
                            // Check if device was disconnected during capture
                            bool stillConnected = false;
                            lock (scannerLock)
                            {
                                try
                                {
                                    stillConnected = (mfs100 != null && mfs100.IsConnected());
                                }
                                catch {}
                            }

                            if (!stillConnected)
                            {
                                Console.WriteLine("[!] Scanner was unplugged! Waiting for reconnection...");
                                isDeviceConnected = false;
                                lock (scannerLock)
                                {
                                    try { if (mfs100 != null) { mfs100.Uninit(); mfs100.Dispose(); } } catch {}
                                    mfs100 = null;
                                }
                                await Task.Delay(1500, token);
                                continue;
                            }

                            // Device is still connected and just timed out with no finger placed.
                            await Task.Delay(150, token);
                            continue;
                        }

                        // ret == 0: A finger was placed on the scanner
                        if (fingerData.ISOTemplate != null && fingerData.ISOTemplate.Length > 0)
                        {
                            Console.WriteLine("\n[*] Finger placed! Matching with registered templates...");
                            int bestScore = 0;
                            StoredTemplate bestMatch = null;
                            
                            var currentTemplates = dbTemplates;
                            
                            foreach (var st in currentTemplates)
                            {
                                int score = 0;
                                lock (scannerLock)
                                {
                                    if (mfs100 != null && isDeviceConnected)
                                    {
                                        int matchRet = mfs100.MatchISO(fingerData.ISOTemplate, st.Bytes, ref score);
                                        if (matchRet == 0 && score > bestScore)
                                        {
                                            bestScore = score;
                                            bestMatch = st;
                                        }
                                    }
                                }
                            }
                            
                            // Mantra Match Score >= 140 indicates an authentic match
                            if (bestScore >= 140 && bestMatch != null)
                            {
                                Console.WriteLine(string.Format("[+] MATCH FOUND! Score: {0}, ID: {1}, Name: {2}, Role: {3}", bestScore, bestMatch.Id, bestMatch.Name, bestMatch.Role));
                                string responseJson = string.Format(
                                    "{{\"type\": \"scan\", \"userId\": \"{0}\", \"name\": \"{1}\", \"userRole\": \"{2}\", \"fingerprintId\": \"{3}\"}}",
                                    bestMatch.Id,
                                    EscapeJson(bestMatch.Name),
                                    bestMatch.Role,
                                    bestMatch.Base64Data
                                );
                                byte[] bytes = Encoding.UTF8.GetBytes(responseJson);
                                try
                                {
                                    await webSocket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
                                }
                                catch {}
                                
                                // Pause 3 seconds after successful punch to avoid accidental double-punches
                                await Task.Delay(3000, token);
                            }
                            else
                            {
                                Console.WriteLine(string.Format("[-] No registered match found. Best score was: {0}", bestScore));
                                string responseJson = "{\"type\": \"scan\", \"fingerprintId\": \"UNKNOWN\"}";
                                byte[] bytes = Encoding.UTF8.GetBytes(responseJson);
                                try
                                {
                                    await webSocket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
                                }
                                catch {}
                                await Task.Delay(1500, token);
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine("[!] Loop iteration error: " + ex.Message);
                }
                
                await Task.Delay(150, token);
            }
        }

        static string EscapeJson(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "").Replace("\n", "");
        }

        static async Task SendError(WebSocket webSocket, string error)
        {
            string responseJson = string.Format("{{\"type\": \"scan_result\", \"success\": false, \"error\": \"{0}\"}}", EscapeJson(error));
            byte[] bytes = Encoding.UTF8.GetBytes(responseJson);
            try
            {
                await webSocket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
            }
            catch {}
        }
    }
}
