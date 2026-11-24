use super::interfaces::Scope;
use socket2::{Domain, Protocol, Socket, Type};
use std::io;
use std::net::{IpAddr, SocketAddr};

// Explicit egress interface selection is required even when routes overlap.
// Fail closed if a platform refuses ordinary-user interface binding.
pub fn bind_interface(socket: &Socket, scope: &Scope, ipv6: bool) -> io::Result<()> {
    #[cfg(target_os = "macos")]
    {
        let index = std::num::NonZeroU32::new(scope.public.interface_index);
        if ipv6 {
            socket.bind_device_by_index_v6(index)
        } else {
            socket.bind_device_by_index_v4(index)
        }
    }
    #[cfg(target_os = "linux")]
    {
        use std::os::fd::AsRawFd;
        let index = if ipv6 {
            scope.public.interface_index
        } else {
            scope.public.interface_index.to_be()
        };
        let (level, option) = if ipv6 {
            (libc::IPPROTO_IPV6, libc::IPV6_UNICAST_IF)
        } else {
            (libc::IPPROTO_IP, libc::IP_UNICAST_IF)
        };
        let result = unsafe {
            libc::setsockopt(
                socket.as_raw_fd(),
                level,
                option,
                &index as *const _ as *const libc::c_void,
                std::mem::size_of_val(&index) as libc::socklen_t,
            )
        };
        if result == 0 {
            Ok(())
        } else {
            Err(io::Error::last_os_error())
        }
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::io::AsRawSocket;
        use windows_sys::Win32::Networking::WinSock::*;
        let index = if ipv6 {
            scope.public.interface_index
        } else {
            scope.public.interface_index.to_be()
        };
        let (level, option) = if ipv6 {
            (IPPROTO_IPV6, IPV6_UNICAST_IF)
        } else {
            (IPPROTO_IP, IP_UNICAST_IF)
        };
        let result = unsafe {
            setsockopt(
                socket.as_raw_socket() as SOCKET,
                level,
                option,
                &index as *const _ as *const u8,
                4,
            )
        };
        if result == 0 {
            Ok(())
        } else {
            Err(io::Error::from_raw_os_error(unsafe { WSAGetLastError() }))
        }
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        let _ = (socket, scope, ipv6);
        Err(io::Error::new(
            io::ErrorKind::Unsupported,
            "interface binding unavailable",
        ))
    }
}

pub fn udp(
    scope: &Scope,
    ipv6: bool,
    mdns: bool,
) -> io::Result<(tokio::net::UdpSocket, SocketAddr)> {
    let source: IpAddr = if ipv6 {
        scope.v6().ok_or(io::ErrorKind::AddrNotAvailable)?.into()
    } else {
        scope.v4().ok_or(io::ErrorKind::AddrNotAvailable)?.into()
    };
    let group: IpAddr = match (ipv6, mdns) {
        (false, true) => "224.0.0.251",
        (false, false) => "239.255.255.250",
        (true, true) => "ff02::fb",
        (true, false) => "ff02::c",
    }
    .parse()
    .unwrap();
    let socket = Socket::new(
        if ipv6 { Domain::IPV6 } else { Domain::IPV4 },
        Type::DGRAM,
        Some(Protocol::UDP),
    )?;
    bind_interface(&socket, scope, ipv6)?;
    if mdns {
        socket.set_reuse_address(true)?;
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        socket.set_reuse_port(true)?;
    }
    // Bind the protocol port for multicast delivery; SO_REUSEADDR permits the
    // OS responder to share it, while the per-interface membership filters input.
    socket.bind(
        &scope
            .socket_address(source, if mdns { 5353 } else { 0 })
            .into(),
    )?;
    if ipv6 {
        socket.set_multicast_if_v6(scope.public.interface_index)?;
        socket.set_multicast_hops_v6(1)?;
        socket.set_multicast_loop_v6(false)?;
        if mdns {
            socket.join_multicast_v6(&"ff02::fb".parse().unwrap(), scope.public.interface_index)?;
        }
    } else {
        socket.set_multicast_if_v4(&scope.v4().unwrap())?;
        socket.set_multicast_ttl_v4(1)?;
        socket.set_multicast_loop_v4(false)?;
        if mdns {
            socket.join_multicast_v4(&"224.0.0.251".parse().unwrap(), &scope.v4().unwrap())?;
        }
    }
    socket.set_nonblocking(true)?;
    Ok((
        tokio::net::UdpSocket::from_std(socket.into())?,
        scope.socket_address(group, if mdns { 5353 } else { 1900 }),
    ))
}
