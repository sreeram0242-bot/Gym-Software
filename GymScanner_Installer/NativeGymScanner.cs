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
        static string currentServerUrl = "http://localhost:3000";
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

        static void Log(string msg)
        {
            try
            {
                Console.WriteLine(msg);
            }
            catch {}
            try
            {
                string logDir = AppDomain.CurrentDomain.BaseDirectory;
                string logPath = Path.Combine(logDir, "scanner.log");
                File.AppendAllText(logPath, string.Format("[{0:yyyy-MM-dd HH:mm:ss}] {1}\r\n", DateTime.Now, msg));
            }
            catch {}
        }

        static void Main(string[] args)
        {
            AppDomain.CurrentDomain.UnhandledException += (s, e) =>
            {
                Log("[FATAL UNHANDLED] " + (e.ExceptionObject != null ? e.ExceptionObject.ToString() : "Unknown exception"));
            };
            try
            {
                Log("=== Starting NativeGymScanner ===");
                MainAsync(args).GetAwaiter().GetResult();
            }
            catch (Exception ex)
            {
                Log("[FATAL EXCEPTION] " + ex.ToString());
            }
        }

        static async Task MainAsync(string[] args)
        {
            Log("=================================================");
            Log("  GymFlow Native Fingerprint Bridge (MFS100)     ");
            Log("  Auto-Reconnect & Multi-Mode Biometric Service  ");
            Log("=================================================");

            InitializeDevice();

            HttpListener listener = new HttpListener();
            try
            {
                listener.Prefixes.Add("http://localhost:8765/");
                listener.Start();
                Log("[*] WebSocket bridge listening on ws://localhost:8765/");
            }
            catch (Exception ex)
            {
                Log("[!] Failed to bind port 8765: " + ex.Message);
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
                    Log("[!] Listener error: " + ex.Message);
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
                            Log("[*] MFS100 Device Initialized Successfully!");
                            return;
                        }
                        else
                        {
                            Log(string.Format("[!] MFS100 Init returned code {0}. Waiting for valid hardware state...", ret));
                        }
                    }
                    else
                    {
                        Log("[!] MFS100 scanner is not plugged in. Waiting for USB connection...");
                    }
                }
                catch (Exception ex)
                {
                    Log("[!] Device init exception: " + ex.Message);
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
                Log("[*] Dashboard UI Client Connected!");
            }
            catch (Exception e)
            {
                Log("Error accepting WS: " + e.Message);
                return;
            }

            WebSocket webSocket = webSocketContext.WebSocket;
            CancellationTokenSource cts = new CancellationTokenSource();
            bool isThisConnContinuous = false;

            // Immediately send current hardware device status to the freshly connected client
            try
            {
                string initStatus = string.Format(
                    "{{\"type\":\"device_status\",\"deviceReady\":{0},\"message\":\"{1}\"}}",
                    isDeviceConnected ? "true" : "false",
                    isDeviceConnected ? "Fingerprint scanner ready — place finger on sensor" : "Scanner offline. Check USB connection or click Reconnect"
                );
                byte[] initBytes = Encoding.UTF8.GetBytes(initStatus);
                await webSocket.SendAsync(new ArraySegment<byte>(initBytes), WebSocketMessageType.Text, true, CancellationToken.None);
            }
            catch {}
            
            // Start the continuous scanning background loop for this connection
            Task scanLoop = Task.Run(() => ContinuousScanLoop(webSocket, cts.Token));

            try
            {
                byte[] receiveBuffer = new byte[16384];
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
                        Log("Received: " + (message.Length > 200 ? message.Substring(0, 200) + "..." : message));
                        
                        if (message.Contains("\"action\":\"scan\"") || message.Contains("\"action\": \"scan\""))
                        {
                            // Temporary pause continuous loop while single registration capture is running
                            isPausedForManualScan = true;
                            Log("[*] Manual scan requested by dashboard (Registration)");
                            
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
                                        Log("[*] Please place finger on scanner for registration...");
                                        ret = mfs100.AutoCapture(ref fingerData, 10000, false, true);
                                    }
                                }
                                
                                if (!ready)
                                {
                                    manualError = "Scanner not plugged in. Please connect USB cable.";
                                }
                                else if (ret == 0 && fingerData.ISOTemplate != null)
                                {
                                    Log("[*] Registration Scan Successful!");
                                    successTemplate = Convert.ToBase64String(fingerData.ISOTemplate);
                                }
                                else
                                {
                                    Log(string.Format("[!] Scan failed. Error Code: {0}", ret));
                                    manualError = "Scan failed. Please place your finger firmly and try again.";
                                }
                            }
                            catch (Exception ex)
                            {
                                Log("[!] Exception in manual scan: " + ex.Message);
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
                                Log("[*] Start Continuous Check-in Mode for Gym: " + currentGymId);
                            }
                            Match sUrlM = Regex.Match(message, "\"serverUrl\"\\s*:\\s*\"(.*?)\"");
                            if (sUrlM.Success && !string.IsNullOrEmpty(sUrlM.Groups[1].Value))
                            {
                                currentServerUrl = sUrlM.Groups[1].Value.TrimEnd('/');
                                Log("[*] Using Server URL: " + currentServerUrl);
                            }
                            if (!string.IsNullOrEmpty(currentGymId))
                            {
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
                            Log("[*] Stopped Continuous Check-in Mode for this connection.");
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
                        else if (message.Contains("\"sync_templates\"") || message.Contains("\"push_templates\""))
                        {
                            Log("[*] Direct templates payload received from dashboard UI");
                            ParseAndStoreTemplates(message);
                        }
                        else if (message.Contains("\"reconnect\"") || message.Contains("\"reinit\""))
                        {
                            Log("[*] Reconnect/re-init requested by client");
                            InitializeDevice();
                            string statusMsg = string.Format(
                                "{{\"type\":\"device_status\",\"deviceReady\":{0},\"message\":\"{1}\"}}",
                                isDeviceConnected ? "true" : "false",
                                isDeviceConnected ? "Fingerprint scanner ready — place finger on sensor" : "MFS100 Scanner not detected. Please check USB cable."
                            );
                            byte[] statusBytes = Encoding.UTF8.GetBytes(statusMsg);
                            await webSocket.SendAsync(new ArraySegment<byte>(statusBytes), WebSocketMessageType.Text, true, CancellationToken.None);
                        }
                        else if (message.Contains("\"action\":\"sync\"") || message.Contains("\"action\":\"refresh\"") || message.Contains("\"refresh_templates\""))
                        {
                            Log("[*] Immediate template refresh requested by dashboard.");
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
                Log("Connection Exception: " + e.Message);
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
                Log("[*] Dashboard UI Client Disconnected.");
            }
        }

        static void ParseAndStoreTemplates(string json)
        {
            try
            {
                var newTemplates = new List<StoredTemplate>();
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
                if (newTemplates.Count > 0)
                {
                    dbTemplates = newTemplates;
                    lastTemplateSync = DateTime.UtcNow;
                    Log(string.Format("[*] Synced {0} member & staff templates directly from dashboard!", dbTemplates.Count));
                }
            }
            catch (Exception ex)
            {
                Log("[!] Error parsing direct templates: " + ex.Message);
            }
        }
        
        static void FetchTemplates(string gymId)
        {
            if (string.IsNullOrEmpty(gymId)) return;
            try
            {
                string syncUrl = currentServerUrl + "/api/biometrics/sync?gymId=" + gymId;
                Log("[*] Fetching registered member fingerprints from server: " + syncUrl);
                using (WebClient client = new WebClient())
                {
                    client.Encoding = Encoding.UTF8;
                    string json = client.DownloadString(syncUrl);
                    
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
                    
                    if (newTemplates.Count > 0 || dbTemplates.Count == 0)
                    {
                        dbTemplates = newTemplates;
                        lastTemplateSync = DateTime.UtcNow;
                        Log(string.Format("[*] Downloaded {0} member & staff fingerprints successfully.", dbTemplates.Count));
                    }
                }
            } 
            catch (Exception ex)
            {
                Log("[!] Remote template sync notice: " + ex.Message + " (will rely on dashboard direct sync if available)");
            }
        }
        
        static async Task ContinuousScanLoop(WebSocket webSocket, CancellationToken token)
        {
            bool previousDeviceReady = isDeviceConnected;

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

                        // Check USB connection only if device was previously marked disconnected
                        bool deviceReady = isDeviceConnected;
                        if (!isDeviceConnected)
                        {
                            lock (scannerLock)
                            {
                                try
                                {
                                    if (mfs100 == null) mfs100 = new MFS100();
                                    if (mfs100.IsConnected())
                                    {
                                        int initRet = mfs100.Init();
                                        if (initRet == 0)
                                        {
                                            isDeviceConnected = true;
                                            deviceReady = true;
                                            Log("[*] MFS100 Scanner Reconnected & Ready!");
                                        }
                                    }
                                }
                                catch (Exception ex)
                                {
                                    Log("[!] USB state check error: " + ex.Message);
                                    isDeviceConnected = false;
                                }
                            }
                        }

                        // Broadcast hardware state transition to browser UI
                        if (deviceReady != previousDeviceReady)
                        {
                            previousDeviceReady = deviceReady;
                            try
                            {
                                string devStatus = string.Format(
                                    "{{\"type\":\"device_status\",\"deviceReady\":{0},\"message\":\"{1}\"}}",
                                    deviceReady ? "true" : "false",
                                    deviceReady ? "Fingerprint scanner ready — place finger on sensor" : "MFS100 Scanner disconnected. Please check USB cable."
                                );
                                byte[] devBytes = Encoding.UTF8.GetBytes(devStatus);
                                await webSocket.SendAsync(new ArraySegment<byte>(devBytes), WebSocketMessageType.Text, true, CancellationToken.None);
                            }
                            catch {}
                        }

                        if (!deviceReady)
                        {
                            // Scanner is unplugged. Wait gently and loop without crashing.
                            await Task.Delay(1000, token);
                            continue;
                        }

                        // High-Speed Instant Fingerprint Capture (sub-second / milliseconds)
                        FingerData fingerData = new FingerData();
                        int ret = -1;

                        try
                        {
                            lock (scannerLock)
                            {
                                if (mfs100 != null && isDeviceConnected)
                                {
                                    // 2000ms timeout with IsDetectFinger = true triggers IMMEDIATELY on touch
                                    ret = mfs100.AutoCapture(ref fingerData, 2000, false, true);
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            Log("[!] AutoCapture exception (likely unplugged): " + ex.Message);
                            ret = -999;
                        }

                        if (ret != 0)
                        {
                            // If AutoCapture failed with an error, check if device was disconnected
                            if (ret != -1140 && ret != -1307 && ret != -999) // Normal timeout codes
                            {
                                await Task.Delay(10, token);
                                continue;
                            }

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
                                Log("[!] Scanner was unplugged! Waiting for reconnection...");
                                isDeviceConnected = false;
                                previousDeviceReady = false;
                                try
                                {
                                    string unpluggedJson = "{\"type\":\"device_status\",\"deviceReady\":false,\"message\":\"MFS100 Scanner disconnected. Please check USB cable.\"}";
                                    byte[] uBytes = Encoding.UTF8.GetBytes(unpluggedJson);
                                    await webSocket.SendAsync(new ArraySegment<byte>(uBytes), WebSocketMessageType.Text, true, CancellationToken.None);
                                }
                                catch {}

                                lock (scannerLock)
                                {
                                    try { if (mfs100 != null) { mfs100.Uninit(); mfs100.Dispose(); } } catch {}
                                    mfs100 = null;
                                }
                                await Task.Delay(1000, token);
                                continue;
                            }

                            await Task.Delay(10, token);
                            continue;
                        }

                        // ret == 0: A finger was instantly detected and captured!
                        if (fingerData.ISOTemplate != null && fingerData.ISOTemplate.Length > 0)
                        {
                            Log("\n[*] Finger placed! Instant matching with registered templates...");
                            int bestScore = 0;
                            StoredTemplate bestMatch = null;
                            
                            var currentTemplates = dbTemplates;
                            
                            lock (scannerLock)
                            {
                                if (mfs100 != null && isDeviceConnected)
                                {
                                    foreach (var st in currentTemplates)
                                    {
                                        int score = 0;
                                        int matchRet = mfs100.MatchISO(fingerData.ISOTemplate, st.Bytes, ref score);
                                        if (matchRet == 0 && score > bestScore)
                                        {
                                            bestScore = score;
                                            bestMatch = st;
                                            // Score >= 160 is a definitive match - break early for millisecond speed!
                                            if (bestScore >= 160) break;
                                        }
                                    }
                                }
                            }
                            
                            // Mantra Match Score >= 140 indicates an authentic match
                            if (bestScore >= 140 && bestMatch != null)
                            {
                                Log(string.Format("[+] MATCH FOUND! Score: {0}, ID: {1}, Name: {2}, Role: {3}", bestScore, bestMatch.Id, bestMatch.Name, bestMatch.Role));
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
                                
                                // Brief 1 second cooldown after successful punch
                                await Task.Delay(1000, token);
                            }
                            else
                            {
                                Log(string.Format("[-] No registered match found. Best score was: {0}", bestScore));
                                string responseJson = "{\"type\": \"scan\", \"fingerprintId\": \"UNKNOWN\"}";
                                byte[] bytes = Encoding.UTF8.GetBytes(responseJson);
                                try
                                {
                                    await webSocket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
                                }
                                catch {}
                                await Task.Delay(800, token);
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    Log("[!] Loop iteration error: " + ex.Message);
                }
                
                await Task.Delay(15, token);
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
