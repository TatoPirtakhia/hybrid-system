package expo.modules.androidclassicspp

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID
import java.util.concurrent.Executors

class AndroidClassicSppModule : Module() {
  private val sppUuid = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
  private val io = Executors.newSingleThreadExecutor()
  private var socket: BluetoothSocket? = null
  @Volatile private var status = "DISCONNECTED"

  override fun definition() = ModuleDefinition {
    Name("AndroidClassicSpp")
    Events("onData", "onDisconnected")

    AsyncFunction("scan") { promise: Promise ->
      try {
        ensurePermission()
        val devices = adapter().bondedDevices.map { mapOf("id" to it.address, "name" to (it.name ?: "Classic adapter")) }
        promise.resolve(devices)
      } catch (error: Exception) { promise.reject("ERR_SCAN", error.message, error) }
    }

    AsyncFunction("connect") { address: String, promise: Promise ->
      ensurePermission()
      if (socket?.isConnected == true) { promise.resolve(null); return@AsyncFunction }
      status = "CONNECTING"
      io.execute {
        try {
          adapter().cancelDiscovery()
          val candidate = adapter().getRemoteDevice(address).createRfcommSocketToServiceRecord(sppUuid)
          candidate.connect(); socket = candidate; status = "CONNECTED"; startReader(candidate); promise.resolve(null)
        } catch (error: Exception) { status = "ERROR"; promise.reject("ERR_CONNECT", error.message, error) }
      }
    }

    AsyncFunction("write") { hex: String, promise: Promise ->
      if (!hex.matches(Regex("^[0-9A-Fa-f]*$")) || hex.length % 2 != 0 || hex.length > 4096) { promise.reject("ERR_HEX", "Invalid hexadecimal data", null); return@AsyncFunction }
      io.execute {
        try { val bytes = hex.chunked(2).map { it.toInt(16).toByte() }.toByteArray(); socket?.outputStream?.write(bytes) ?: throw IllegalStateException("Not connected"); promise.resolve(null) }
        catch (error: Exception) { promise.reject("ERR_WRITE", error.message, error) }
      }
    }

    AsyncFunction("disconnect") { promise: Promise ->
      try { socket?.close(); socket = null; status = "DISCONNECTED"; promise.resolve(null) }
      catch (error: Exception) { promise.reject("ERR_DISCONNECT", error.message, error) }
    }
    Function("getStatus") { status }
    OnDestroy { try { socket?.close() } catch (_: Exception) {}; io.shutdownNow() }
  }

  private fun adapter(): BluetoothAdapter {
    val context = appContext.reactContext ?: throw IllegalStateException("React context unavailable")
    return (context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter ?: throw IllegalStateException("Bluetooth is unavailable")
  }

  private fun ensurePermission() {
    val context = appContext.reactContext ?: throw IllegalStateException("React context unavailable")
    if (Build.VERSION.SDK_INT >= 31 && context.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) throw SecurityException("Bluetooth Connect permission is required")
  }

  private fun startReader(connected: BluetoothSocket) = io.execute {
    val buffer = ByteArray(1024)
    try { while (connected.isConnected) { val count = connected.inputStream.read(buffer); if (count < 0) break; sendEvent("onData", mapOf("hex" to buffer.copyOf(count).joinToString("") { "%02X".format(it) })) } }
    catch (error: Exception) { if (status == "CONNECTED") sendEvent("onDisconnected", mapOf("reason" to (error.message ?: "Connection lost"))) }
    finally { status = "DISCONNECTED"; try { connected.close() } catch (_: Exception) {} }
  }
}
